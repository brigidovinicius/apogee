// Preflight by default. Production --apply requires a reviewed release and backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
const root = new URL("../drizzle/", import.meta.url);
const migrations = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8")).entries.map(entry => {
  const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8");
  return { entry, source, hash: createHash("sha256").update(source).digest("hex") };
});
const columns = {
  member_tool_category: "id:text:NO,slug:text:NO,name:text:NO,description:text:YES,status:text:NO,sort_order:integer:NO,version:integer:NO,created_at:timestamp with time zone:NO,updated_at:timestamp with time zone:NO,updated_by:text:YES",
  member_tool: "id:text:NO,category_id:text:NO,name:text:NO,description:text:NO,url:text:NO,conditions:text:YES,status:text:NO,sort_order:integer:NO,version:integer:NO,reviewed_at:timestamp with time zone:YES,reviewed_by:text:YES,updated_by:text:YES,created_at:timestamp with time zone:NO,updated_at:timestamp with time zone:NO",
};
async function verify(tx, role) {
  for (const [table, shape] of Object.entries(columns)) {
    const [owner] = await tx`select tableowner from pg_tables where schemaname='public' and tablename=${table}`;
    if (owner?.tableowner !== role) throw Error("Ownership divergente.");
    const cols = await tx`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
    if (cols.map(c => `${c.column_name}:${c.data_type}:${c.is_nullable}`).join(",") !== shape) throw Error("Colunas divergentes.");
    const constraints = await tx`select pg_get_constraintdef(oid) as definition from pg_constraint where conrelid=${`public.${table}`}::regclass`;
    const definitions = constraints.map(c => c.definition);
    const common = ["PRIMARY KEY (id)", "'draft'", "'published'", "'archived'", "sort_order >= 0", "sort_order <= 9999", "version >= 1", "ON DELETE SET NULL"];
    const required = table === "member_tool_category"
      ? [...common, "UNIQUE (slug)", "length(slug) <= 80", "length(name) >= 1", "length(name) <= 80", "length(description) <= 240"]
      : [...common, "UNIQUE (url)", "FOREIGN KEY (category_id)", "REFERENCES member_tool_category(id)", "ON DELETE RESTRICT", "FOREIGN KEY (reviewed_by)",
        "length(name) <= 100", "length(description) <= 280", "length(url) <= 2048", "length(conditions) <= 280", "^https://", "reviewed_at IS NOT NULL"];
    if (definitions.length !== (table === "member_tool_category" ? 9 : 13) || required.some(fragment => !definitions.some(d => d.includes(fragment)))) throw Error("Restrições divergentes.");
    const [index] = await tx`select indexdef from pg_indexes where schemaname='public' and tablename=${table} and indexname=${table === 'member_tool' ? 'member_tool_catalogue_idx' : 'member_tool_category_catalogue_idx'}`;
    if (!index || !index.indexdef.includes("status") || !index.indexdef.includes("sort_order")) throw Error("Índice divergente.");
    const grants = await tx`select privilege_type from information_schema.table_privileges where table_schema='public' and table_name=${table} and grantee='PUBLIC'`;
    if (grants.length) throw Error("Privilégios públicos indevidos.");
  }
}
export async function migrateMemberToolbox(sql, { apply = false, expectedRole = "apogee_app" } = {}) {
  const migration = migrations[19];
  if (migration?.entry.tag !== "0019_member_toolbox") throw Error("Migração divergente.");
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    const [actor] = await tx`select current_user as role,has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if (actor.role !== expectedRole || !actor.can_create) throw Error("Papel divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (rows.length < 19 || rows.length > migrations.length || !rows.every((r, i) => r.hash === migrations[i]?.hash && Number(r.created_at) === migrations[i]?.entry.when)) throw Error("Histórico divergente.");
    if (rows.length >= 20) { await verify(tx, expectedRole); return { changed: false, pending: false }; }
    const tables = await tx`select tablename from pg_tables where schemaname='public' and tablename=any(${Object.keys(columns)}::text[])`;
    if (tables.length) throw Error("Esquema parcial/preexistente.");
    if (!apply) return { changed: false, pending: true };
    await tx.unsafe(migration.source);
    await verify(tx, expectedRole);
    await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.entry.when})`;
    return { changed: true, pending: false };
  });
}
async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions(), sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMemberToolbox(sql, { apply: process.argv.includes("--apply") }))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração da caixa de ferramentas não concluída. Confira histórico, papel, esquema e backup. Nenhum segredo foi exibido."); process.exitCode = 1;
});
