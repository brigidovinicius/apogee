// Additive, preflight by default. Production needs its own approval and backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
const root = new URL("../drizzle/", import.meta.url);
const tableColumns = {
  member_benefit: "id,name,partner,description,evidence_url,eligibility,availability,starts_at,ends_at,redemption,redemption_url,status,sort_order,reviewed_by,reviewed_at",
  member_learning_track: "id,name,description,status,sort_order,reviewed_by,reviewed_at",
  member_learning_module: "id,track_id,name,description,deliverable,status,sort_order,reviewed_by,reviewed_at",
  member_learning_activity: "id,module_id,name,instructions,resource_url,status,sort_order,reviewed_by,reviewed_at",
  member_learning_progress: "user_id,activity_id,completed_at",
  member_deliverable_audit: "id,actor_id,entity_type,entity_id,action,status,created_at",
};
async function verify(tx, role, withVerification = false, withMonitor = false) {
  for (const [table, names] of Object.entries(tableColumns)) {
    const [owner] = await tx`select tableowner from pg_tables where schemaname='public' and tablename=${table}`;
    if (owner?.tableowner !== role) throw Error("Ownership divergente.");
    const cols = await tx`select column_name,data_type,is_nullable from information_schema.columns where table_schema='public' and table_name=${table} order by ordinal_position`;
    const upgraded = withVerification && table === "member_benefit";
    const monitored = withMonitor && table === "member_benefit";
    const expectedNames = names + (upgraded ? ",verified_at" : "") + (monitored ? ",audience" : "");
    if (cols.map(c => c.column_name).join(",") !== expectedNames) throw Error("Colunas divergentes.");
    for (const c of cols) {
      const type = ["verified_at", "starts_at", "ends_at", "completed_at", "reviewed_at", "created_at"].includes(c.column_name) ? "timestamp with time zone" : c.column_name === "sort_order" ? "integer" : "text";
      if (c.data_type !== type || c.is_nullable !== (["starts_at", "ends_at", "verified_at"].includes(c.column_name) ? "YES" : "NO")) throw Error("Tipos divergentes.");
    }
    const definitions = (await tx`select pg_get_constraintdef(oid) as d from pg_constraint where conrelid=${`public.${table}`}::regclass`).map(c => c.d);
    const required = table === "member_learning_progress" ? ["PRIMARY KEY (user_id, activity_id)", "FOREIGN KEY (user_id)", "FOREIGN KEY (activity_id)", "ON DELETE CASCADE"] : ["PRIMARY KEY (id)", `FOREIGN KEY (${table === "member_deliverable_audit" ? "actor_id" : "reviewed_by"})`];
    if (table === "member_learning_module") required.push("FOREIGN KEY (track_id)");
    if (table === "member_learning_activity") required.push("FOREIGN KEY (module_id)");
    if (table !== "member_learning_progress" && table !== "member_deliverable_audit") required.push("sort_order >= 0", "sort_order <= 10000", "'draft'", "'published'", "'archived'");
    if (table === "member_benefit") required.push("ends_at > starts_at", "length(evidence_url)", "length(redemption)", "starts_at IS NOT NULL", "ends_at IS NOT NULL");
    if (table === "member_deliverable_audit") required.push("'benefit'", "'activity'", "'create'", "'update'");
    const counts = { member_benefit: 6, member_learning_track: 4, member_learning_module: 5, member_learning_activity: 5, member_learning_progress: 3, member_deliverable_audit: 4 };
    if (upgraded) required.push("verified_at IS NULL", "verified_at IS NOT NULL", "length(redemption_url)");
    if (monitored) required.push("audience", "'estudantes'", "'startups'");
    if (definitions.length !== counts[table] + Number(upgraded) + Number(monitored) || required.some(s => !definitions.some(d => d.includes(s)))) throw Error("Restrições divergentes.");
    const grants = await tx`select privilege_type from information_schema.table_privileges where table_schema='public' and table_name=${table} and grantee='PUBLIC'`;
    if (grants.length) throw Error("Privilégios públicos indevidos.");
  }
}
export async function migrateMemberDeliverables(sql, { apply = false, expectedRole = "apogee_app" } = {}) {
  const entries = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8")).entries;
  const migrations = entries.map(entry => { const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8"); return { ...entry, source, hash: createHash("sha256").update(source).digest("hex") }; });
  const index = migrations.findIndex(m => m.tag === "0020_member_deliverables");
  if (index !== 20 || migrations[19]?.tag !== "0019_member_toolbox") throw Error("Histórico de entregas divergente.");
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    const [actor] = await tx`select current_user as role,has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if (actor.role !== expectedRole || !actor.can_create) throw Error("Papel divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (rows.length < index || rows.length > migrations.length || !rows.every((r, i) => r.hash === migrations[i].hash && Number(r.created_at) === migrations[i].when)) throw Error("Histórico divergente. Aplique primeiro a migração da Caixa de Ferramentas.");
    if (rows.length > index) { await verify(tx, expectedRole, rows.length > 22, rows.length > 23); return { changed: false, pending: false }; }
    const tables = Object.keys(tableColumns);
    const present = await tx`select tablename from pg_tables where schemaname='public' and tablename=any(${tables}::text[])`;
    if (present.length) throw Error("Esquema parcial/preexistente.");
    if (!apply) return { changed: false, pending: true };
    await tx.unsafe(migrations[index].source);
    await verify(tx, expectedRole);
    await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migrations[index].hash},${migrations[index].when})`;
    return { changed: true, pending: false };
  });
}
async function main() {
  if (process.argv.slice(2).some(a => a !== "--apply")) throw Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions(), sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMemberDeliverables(sql, { apply: process.argv.includes("--apply") }))); } finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => { console.error("Migração não concluída. Confira papel, histórico, esquema e backup. Nenhum segredo foi exibido."); process.exitCode = 1; });
