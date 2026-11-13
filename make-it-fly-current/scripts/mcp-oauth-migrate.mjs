// Narrow, additive migration. Production requires authorization and a verified backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const target = "0016_mcp_oauth";
const migrations = journal.entries.map(entry => {
  const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8");
  return { entry, source, hash: createHash("sha256").update(source).digest("hex") };
});
const tables = ["mcp_oauth_client", "mcp_oauth_resource", "mcp_oauth_client_resource", "mcp_oauth_refresh_token",
  "mcp_oauth_access_token", "mcp_oauth_consent", "mcp_oauth_client_assertion", "mcp_oauth_family"];

export async function migrateMcpOAuth(sql, { apply = false } = {}) {
  const migration = migrations[16];
  if (migration?.entry.tag !== target || migration.hash !== "dd93b847714ec2ce7e00d94825f51ddee41e9739ceae78b0ef83693531829c7a") throw Error("Migração alvo divergente.");
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    const [actor] = await tx`select current_user as role, has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if (actor.role !== "apogee_app" || !actor.can_create) throw Error("Papel de migração divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (![16,17].includes(rows.length) || !rows.every((row,i) => migrations[i] && row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].entry.when)) throw Error("Histórico divergente.");
    const present = await tx`select tablename,tableowner from pg_tables where schemaname='public' and tablename=any(${tables}::text[])`;
    if (rows.length === 17) {
      if (present.length !== 8 || present.some(row => row.tableowner !== "apogee_app")) throw Error("Esquema/ownership divergente.");
      return { changed: false, pending: false, migration: target };
    }
    if (present.length) throw Error("Esquema parcial/preexistente; migração recusada.");
    if (!apply) return { changed: false, pending: true, migration: target, newTables: tables.length };
    await tx.unsafe(migration.source);
    const created = await tx`select tablename,tableowner from pg_tables where schemaname='public' and tablename=any(${tables}::text[])`;
    if (created.length !== 8 || created.some(row => row.tableowner !== "apogee_app")) throw Error("Migração incompleta; transação revertida.");
    await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values (${migration.hash},${migration.entry.when})`;
    return { changed: true, pending: false, migration: target, newTables: tables.length };
  });
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("Migração exige TLS.");
  const { url, options } = databaseOptions(); const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMcpOAuth(sql, { apply: process.argv.includes("--apply") }))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração MCP não concluída. Confira histórico, papel, esquema, backup e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
