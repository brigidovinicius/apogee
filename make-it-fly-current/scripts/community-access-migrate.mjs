// Additive only. Production execution requires separate authorization and a verified backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
const root=new URL("../drizzle/",import.meta.url);
const entries=JSON.parse(readFileSync(new URL("meta/_journal.json",root),"utf8")).entries;
const migrations=entries.map(entry=>{const source=readFileSync(new URL(`${entry.tag}.sql`,root),"utf8");return {entry,source,hash:createHash("sha256").update(source).digest("hex")};});
const groups=[
  ["community_customer","community_checkout_attempt","community_subscription","community_invoice","community_stripe_event"],
  ["radar_free_event"],
];
const columns={
  community_customer:"user_id:text:NO,livemode:boolean:NO,customer_id:text:NO",
  community_checkout_attempt:"user_id:text:NO,livemode:boolean:NO,request_key:text:NO,return_path:text:NO,expires_at:timestamp with time zone:NO",
  community_subscription:"id:text:NO,user_id:text:NO,customer_id:text:NO,livemode:boolean:NO,status:text:NO,cancel_at_period_end:boolean:NO,updated_at:timestamp with time zone:NO",
  community_invoice:"id:text:NO,subscription_id:text:NO,amount:integer:NO,currency:text:NO,period_start:timestamp with time zone:NO,period_end:timestamp with time zone:NO,status:text:NO,fraud_review_required:boolean:NO,payment_intent_id:text:YES,charge_id:text:YES,updated_at:timestamp with time zone:NO",
  community_stripe_event:"event_id:text:NO,event_type:text:NO,processed_at:timestamp with time zone:NO",
  radar_free_event:"user_id:text:NO,opportunity_id:text:NO,slot:smallint:NO,opened_at:timestamp with time zone:NO",
};
async function verify(tx,tables,role) {
  for(const table of tables) {
    const [owner]=await tx`select tableowner from pg_tables where schemaname='public' and tablename=${table}`;
    if(owner?.tableowner!==role) throw Error("Ownership divergente.");
    const cols=await tx`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
    if(cols.map(c=>`${c.column_name}:${c.data_type}:${c.is_nullable}`).join(',')!==columns[table]) throw Error("Colunas divergentes.");
    const constraints=await tx`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=${`public.${table}`}::regclass`;
    const definitions=constraints.map(c=>c.definition);
    const required={
      community_customer:['PRIMARY KEY (user_id, livemode)','UNIQUE (customer_id, livemode)','FOREIGN KEY (user_id)','ON DELETE CASCADE'],
      community_checkout_attempt:['PRIMARY KEY (user_id, livemode)','FOREIGN KEY (user_id)','ON DELETE CASCADE'],
      community_subscription:['PRIMARY KEY (id)','FOREIGN KEY (user_id)','ON DELETE CASCADE'],
      community_invoice:['PRIMARY KEY (id)','FOREIGN KEY (subscription_id)','REFERENCES community_subscription(id)','amount = 143880',"currency = 'brl'",'period_end > period_start',"'paid'","'unpaid'","'refunded'","'disputed'","'fraud'"],
      community_stripe_event:['PRIMARY KEY (event_id)'],
      radar_free_event:['PRIMARY KEY (user_id, opportunity_id)','UNIQUE (user_id, slot)','FOREIGN KEY (user_id)','ON DELETE CASCADE','^[A-Za-z0-9_-]{1,200}$','slot >= 1','slot <= 10'],
    }[table];
    if(required.some(fragment=>!definitions.some(d=>d.includes(fragment)))) throw Error("Restrições divergentes.");
    const expectedCount={community_customer:3,community_checkout_attempt:2,community_subscription:2,community_invoice:6,community_stripe_event:1,radar_free_event:5}[table];
    if(definitions.length!==expectedCount) throw Error("Restrições divergentes.");
    if(table==='radar_free_event' && (!definitions.some(d=>d==='UNIQUE (user_id, slot)') || !definitions.some(d=>d.includes('slot >= 1') && d.includes('slot <= 10')) || !definitions.some(d=>d.includes('ON DELETE CASCADE')))) throw Error("Limite ou vínculo divergente.");
    if(table==='community_invoice' && !definitions.some(d=>d.includes('period_end > period_start'))) throw Error("Período divergente.");
  }
}
export async function migrateCommunityAccess(sql,{apply=false,expectedRole="apogee_app"}={}) {
  if(migrations[17]?.entry.tag!=="0017_community_annual" || migrations[18]?.entry.tag!=="0018_radar_event_queries") throw Error("Migrações divergentes.");
  return sql.begin(async tx=>{
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    const [actor]=await tx`select current_user as role,has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if(actor.role!==expectedRole || !actor.can_create) throw Error("Papel divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows=await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if(![17,18,19].includes(rows.length) || !rows.every((r,i)=>r.hash===migrations[i]?.hash && Number(r.created_at)===migrations[i]?.entry.when)) throw Error("Histórico divergente.");
    const applied=[];
    for(let i=17;i<=18;i++) {
      const tables=groups[i-17];
      const present=await tx`select tablename from pg_tables where schemaname='public' and tablename=any(${tables}::text[])`;
      if(i<rows.length) { await verify(tx,tables,expectedRole); continue; }
      if(present.length) throw Error("Esquema parcial/preexistente.");
      if(!apply) continue;
      await tx.unsafe(migrations[i].source);
      await verify(tx,tables,expectedRole);
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migrations[i].hash},${migrations[i].entry.when})`;
      applied.push(migrations[i].entry.tag);
    }
    return {changed:applied.length>0,pending:!apply && rows.length<19,applied};
  });
}
async function main() {
  if(process.argv.slice(2).some(arg=>arg!=="--apply")) throw Error("Argumento inválido.");
  if(process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE!=="require") throw Error("Migração operacional exige TLS.");
  const {url,options}=databaseOptions(),sql=postgres(url,{...options,connect_timeout:10});
  try {console.log(JSON.stringify(await migrateCommunityAccess(sql,{apply:process.argv.includes('--apply')})));} finally {await sql.end();}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(()=>{console.error("Migração não concluída. Confira histórico, papel, esquema, backup e conexão. Nenhum segredo foi exibido.");process.exitCode=1;});
