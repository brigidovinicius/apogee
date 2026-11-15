// Run through the global npm queue. Owns an isolated native PostgreSQL and dev server.
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile,writeFile } from "node:fs/promises";
import { hashPassword } from "better-auth/crypto";
import { nativeCommunityDatabase } from "../tests/helpers/community-native-db.mjs";
import { migrateCommunityAccess } from "./community-access-migrate.mjs";
import { migrateMemberToolbox } from "./member-toolbox-migrate.mjs";
const statePath='/private/tmp/apogee-toolbox-review-state.json';
let previous;
try { previous=JSON.parse(await readFile(statePath,'utf8')); } catch(error) { if(error.code!=='ENOENT')throw error; }
const db=await nativeCommunityDatabase({directory:previous?.dir,preserve:true});
let server,closing=false;
async function close(code=0) {
  if(closing)return;closing=true;
  if(server && server.exitCode===null)server.kill('SIGTERM');
  await db.close();process.exit(code);
}
process.on('SIGTERM',()=>void close());process.on('SIGINT',()=>void close());
try {
  await migrateCommunityAccess(db.sql,{apply:true,expectedRole:'apogee_local'});
  await migrateMemberToolbox(db.sql,{apply:true,expectedRole:'apogee_local'});
  if(!db.resumed) {
  const password=await hashPassword('RevisaoLocal2026!');
  for(const username of ['revisaolivre','revisaolimite','revisaolegado','revisaoanual','revisaoadmin','revisaoexpirado','revisaoreembolso']) {
    await db.sql`insert into "user"(id,name,email,email_verified,username,adult_declared) values(${username},'Pessoa Revisora',${username+'@example.test'},true,${username},true)`;
    await db.sql`insert into account(id,account_id,provider_id,user_id,password) values(${username},${username},'credential',${username},${password})`;
    await db.sql`insert into member_adult_review(user_id,status,reviewed_at,evidence_reference) values(${username},'approved',now(),'synthetic_local_review')`;
  }
  await db.sql`update "user" set role='admin' where id='revisaoadmin'`;
  for(let i=1;i<=10;i++) await db.sql`insert into radar_free_event(user_id,opportunity_id,slot) values('revisaolimite',${'review-event-'+i},${i})`;
  await db.sql`insert into radar_legacy_access(user_id) values('revisaolegado')`;
  await db.sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values('sub_LocalReview','revisaoanual','cus_LocalReview',false,'active',true)`;
  await db.sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status) values('in_LocalReview','sub_LocalReview',143880,'brl',now()-interval '1 day',now()+interval '1 year'-interval '1 day','paid')`;
  for(const id of ['revisaoexpirado','revisaoreembolso']) {
    await db.sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values(${'sub_'+id},${id},${'cus_'+id},false,'canceled',true)`;
    await db.sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status)
      values(${'in_'+id},${'sub_'+id},143880,'brl',now()-interval '1 year',${id==='revisaoexpirado' ? new Date(Date.now()-86400000).toISOString() : new Date(Date.now()+86400000).toISOString()},${id==='revisaoreembolso'?'refunded':'paid'})`;
  }
  const categoryIds=[];
  for(const [order,name,slug] of [[0,'Vídeo','video'],[1,'Imagem e design','imagem-e-design'],[2,'Áudio','audio'],[3,'Texto e pesquisa','texto-e-pesquisa'],[4,'Produtividade e automação','produtividade-e-automacao'],[5,'Programação','programacao']]) {
    const categoryId=randomUUID();
    categoryIds.push(categoryId);
    await db.sql`insert into member_tool_category(id,slug,name,status,sort_order,updated_by) values(${categoryId},${slug},${name},'published',${order},'revisaoadmin')`;
  }
  await db.sql`insert into member_tool(id,category_id,name,description,url,status,reviewed_at,reviewed_by,updated_by)
    values(${randomUUID()},${categoryIds[0]},'Google Flow','Criação de vídeos com inteligência artificial.','https://labs.google/fx/tools/flow','published',now(),'revisaoadmin','revisaoadmin')`;
  }
  await writeFile(statePath,JSON.stringify({url:db.url,dir:db.dir,data:db.data,pid:process.pid}),{mode:0o600});
  await writeFile('/private/tmp/apogee-functional-review-state.json',JSON.stringify({url:db.url,dir:db.dir,data:db.data,pid:process.pid}));
  const env={...process.env,NODE_ENV:'development',APOGEE_LOCAL_PREVIEW:'1',APOGEE_FUNCTIONAL_REVIEW:'1',
    DATABASE_URL:db.url,DATABASE_SSL_MODE:'disable',DATABASE_POOL_MAX:'2',BETTER_AUTH_URL:'http://127.0.0.1:3461',BETTER_AUTH_SECRET:randomBytes(32).toString('hex'),
    STRIPE_MODE:'test',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:'',COMMUNITY_BILLING_ENABLED:'false',RADAR_BILLING_ENABLED:'false',
    MEMBERS_EMAIL_ENABLED:'false',MEMBERS_RESEND_API_KEY:'',MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',
    GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',MCP_ENABLED:'false',RADAR_GOOGLE_CALENDAR_ENABLED:'false'};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','-H','127.0.0.1','-p','3461'],{env,stdio:'inherit'});
  server.on('exit',code=>void close(code??1));
} catch {console.error('Prévia funcional local não iniciada.');await close(1);}
