import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const tag = "0025_workshop_voucher";
const tables = ["workshop_voucher_assignment", "workshop_voucher_batch", "workshop_voucher_stock"];
const migrations = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8")).entries.map(entry => {
  const source = readFileSync(new URL(entry.tag + ".sql", root), "utf8");
  return { ...entry, source, hash: createHash("sha256").update(source).digest("hex") };
});

export async function migrateWorkshopVouchers(sql, { apply = false, expectedRole = "apogee_app" } = {}) {
  const index = migrations.findIndex(entry => entry.tag === tag);
  if (index !== 25 || migrations[index - 1].tag !== "0024_monthly_detail_unlock") throw new Error("Sequência de migração divergente.");
  const migration = migrations[index];
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true), set_config('statement_timeout','60s',true),
      set_config('search_path','public,pg_catalog',true)`;
    const [actor] = await tx`select current_user as role, has_schema_privilege(current_user,'public','CREATE') as can_create`;
    if (actor.role !== expectedRole || !actor.can_create) throw new Error("Papel de migração divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const history = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (history.length < index || history.length > migrations.length ||
        !history.every((row, i) => row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].when)) {
      throw new Error("Histórico de migrações divergente.");
    }
    const installed = history.length > index;
    const present = () => tx`select tablename,tableowner from pg_tables
      where schemaname='public' and tablename=any(${tables}::text[])`;
    if (!installed) {
      if ((await present()).length) throw new Error("Tabelas sem a migração correspondente.");
      if (!apply) return { migration: tag, changed: false, pending: true };
      await tx.unsafe(migration.source);
    }
    const relations = await present();
    if (relations.length !== tables.length || relations.some(row => row.tableowner !== expectedRole)) {
      throw new Error("Tabelas ou permissões divergentes.");
    }
    const [state] = await tx`select released_at is not null as released,
      notice_started_at is not null as notice_started,
      (select count(*)::int from workshop_voucher_stock) as stock,
      (select count(*)::int from workshop_voucher_assignment) as assignments
      from workshop_voucher_batch where singleton`;
    if (!state || (!installed && (state.released || state.notice_started || state.stock || state.assignments))) {
      throw new Error("Estado inicial do lote divergente.");
    }
    if (!installed) await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.when})`;
    return { migration: tag, changed: !installed, pending: false, ...state };
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--apply")) throw new Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw new Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateWorkshopVouchers(sql, { apply: args.includes("--apply") }))); }
  finally { await sql.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error("Migração do workshop recusada. Confira a sequência, o papel, o banco e o estado do lote.", error.code ?? "");
  process.exitCode = 1;
});
