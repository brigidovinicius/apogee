// Additive and preflight-only by default. A production application needs separate approval.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
const root = new URL("../drizzle/", import.meta.url);
const columns = {
  member_benefit_category: "id,slug,name,description,status,sort_order,version,updated_by,updated_at",
  member_benefit_organization: "benefit_id,category_id,provider_label,provider_access,source_url",
  member_benefit_saved: "user_id,benefit_id,created_at",
  member_benefit_redemption: "id,user_id,benefit_id,benefit_name,partner_name,terms_revision,status,started_at,reviewed_at,reviewed_by,evidence_reference",
};
async function verify(tx, role) {
  for (const [table, expected] of Object.entries(columns)) {
    const [owner] = await tx`select tableowner from pg_tables where schemaname='public' and tablename=${table}`;
    const names = await tx`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
    if (owner?.tableowner !== role || names.map(c => c.column_name).join(",") !== expected) throw Error("Esquema de Benefícios divergente.");
    for (const column of names) {
      const expectedType = ['sort_order','version'].includes(column.column_name) ? 'integer' : ['created_at','updated_at','started_at','reviewed_at'].includes(column.column_name) ? 'timestamp with time zone' : 'text';
      const nullable = ['category_id','reviewed_at','reviewed_by'].includes(column.column_name);
      if (column.data_type !== expectedType || column.is_nullable !== (nullable ? 'YES' : 'NO')) throw Error('Tipos de Benefícios divergentes.');
    }
    const grants = await tx`select privilege_type from information_schema.table_privileges where table_schema='public' and table_name=${table} and grantee='PUBLIC'`;
    if (grants.length) throw Error("Privilégios públicos indevidos.");
    const definitions = (await tx`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=${`public.${table}`}::regclass`).map(c => c.definition).join("\n");
    const required = table === "member_benefit_category" ? ["PRIMARY KEY (id)", "UNIQUE (slug)", "'published'", "version >= 1", "FOREIGN KEY (updated_by)"]
      : table === "member_benefit_organization" ? ["PRIMARY KEY (benefit_id)", "FOREIGN KEY (benefit_id)", "FOREIGN KEY (category_id)", "'unconfirmed'", "'premium'"]
      : table === "member_benefit_saved" ? ["PRIMARY KEY (user_id, benefit_id)", "FOREIGN KEY (user_id)", "FOREIGN KEY (benefit_id)", "ON DELETE CASCADE"]
      : ["PRIMARY KEY (id)", "UNIQUE (user_id, benefit_id)", "FOREIGN KEY (user_id)", "FOREIGN KEY (benefit_id)", "'started'", "'confirmed'", "reviewed_at IS NOT NULL", "length(evidence_reference) >= 8"];
    if (required.some(part => !definitions.includes(part))) throw Error("Restrições de Benefícios divergentes.");
  }
}
export async function migrateMemberBenefits(sql, { apply = false, expectedRole = "apogee_app" } = {}) {
  const entries = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8")).entries;
  const migrations = entries.map(e => { const source = readFileSync(new URL(`${e.tag}.sql`, root), "utf8"); return { ...e, source, hash: createHash("sha256").update(source).digest("hex") }; });
  const index = migrations.findIndex(m => m.tag === "0021_member_benefits_workspace");
  const verification = migrations[index + 1];
  if (verification?.tag !== "0022_member_benefit_verification" || index !== 21 || migrations[20]?.tag !== "0020_member_deliverables") throw Error("Histórico de Benefícios divergente.");
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    const [actor] = await tx`select current_user as role,has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if (actor.role !== expectedRole || !actor.can_create) throw Error("Papel divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (rows.length < index || rows.length > migrations.length || !rows.every((r, i) => r.hash === migrations[i].hash && Number(r.created_at) === migrations[i].when)) throw Error("Histórico divergente. Aplique primeiro as entregas existentes.");
    const baseInstalled = rows.length > index;
    const reviewInstalled = rows.length > index + 1;
    if (baseInstalled) await verify(tx, expectedRole);
    else {
      const present = await tx`select tablename from pg_tables where schemaname='public' and tablename=any(${Object.keys(columns)}::text[])`;
      if (present.length) throw Error("Esquema parcial/preexistente.");
    }
    const checkVerification = async () => {
      const [state] = await tx`select
        exists(select 1 from information_schema.columns where table_schema='public' and table_name='member_benefit' and column_name='verified_at' and data_type='timestamp with time zone' and is_nullable='YES') as has_column,
        to_regprocedure('public.member_benefit_is_current(timestamptz,timestamptz,timestamptz)') is not null as has_function,
        exists(select 1 from pg_constraint where conrelid='public.member_benefit'::regclass and conname='member_benefit_verification_mode') as has_constraint`;
      return Object.values(state);
    };
    const parts = await checkVerification();
    if (reviewInstalled ? parts.some(p => !p) : parts.some(Boolean)) throw Error("Esquema de verificação divergente.");
    if (reviewInstalled || !apply) return { changed: false, pending: !reviewInstalled };
    for (const migration of baseInstalled ? [verification] : [migrations[index], verification]) {
      await tx.unsafe(migration.source);
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.when})`;
    }
    await verify(tx, expectedRole);
    if (!(await checkVerification()).every(Boolean)) throw Error("Verificação incompleta.");
    return { changed: true, pending: false };
  });
}
async function main() {
  if (process.argv.slice(2).some(a => a !== "--apply")) throw Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions(), sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMemberBenefits(sql, { apply: process.argv.includes("--apply") }))); } finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("Migração não concluída. Confira papel, histórico, esquema e backup."); process.exitCode = 1; });
