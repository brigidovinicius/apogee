// Production execution requires explicit database authorization and a verified backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const target = "0007_radar_free_opportunity";
const position = journal.entries.findIndex(entry => entry.tag === target);
const migrations = journal.entries.slice(0, position + 1).map(entry => {
  const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8");
  return { entry, source, hash: createHash("sha256").update(source).digest("hex") };
});

async function completeSchema(tx) {
  const columns = await tx`select column_name, data_type, is_nullable, column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'radar_free_opportunity' order by ordinal_position`;
  const expected = [['user_id', 'text', 'NO', null], ['opportunity_id', 'text', 'NO', null],
    ['opened_at', 'timestamp with time zone', 'NO', 'now()']];
  if (JSON.stringify(columns.map(row => [row.column_name, row.data_type, row.is_nullable, row.column_default])) !== JSON.stringify(expected)) return false;
  const constraints = await tx`select conname, pg_get_constraintdef(oid) as definition from pg_constraint
    where conrelid = 'public.radar_free_opportunity'::regclass`;
  return constraints.some(row => row.conname === 'radar_free_opportunity_pkey' && row.definition === 'PRIMARY KEY (user_id)')
    && constraints.some(row => row.conname === 'radar_free_opportunity_user_id_user_id_fk'
      && row.definition === 'FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE')
    && constraints.some(row => row.conname === 'radar_free_opportunity_id_check' && row.definition.includes("^[A-Za-z0-9_-]{1,200}$"));
}

export async function migrateRadarFreeOpportunity(sql) {
  if (position !== 7) throw new Error("Migração alvo divergente.");
  const migration = migrations[position];
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout', '5s', true)`;
    await tx`select set_config('statement_timeout', '60s', true)`;
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
    if (!rows.every((row, i) => migrations[i] && row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].entry.when)) throw new Error("Histórico divergente; migração recusada.");
    const [state] = await tx`select to_regclass('public.radar_free_opportunity') is not null as present`;
    if (rows.length === 8 && state.present && await completeSchema(tx)) return { changed: false, migration: target };
    if (rows.length !== 7 || state.present) throw new Error("Esquema divergente; migração recusada.");
    await tx.unsafe(migration.source);
    if (!await completeSchema(tx)) throw new Error("Esquema incompleto; migração revertida.");
    await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${migration.hash}, ${migration.entry.when})`;
    return { changed: true, migration: target };
  });
}

async function main() {
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw new Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateRadarFreeOpportunity(sql))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração da oportunidade gratuita não concluída. Verifique histórico, esquema, backup e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
