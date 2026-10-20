// Apply only after explicit database authorization and a verified backup.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const target = "0006_store_drop_signups";
const position = journal.entries.findIndex(entry => entry.tag === target);
const migrations = journal.entries.slice(0, position + 1).map(entry => {
  const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8");
  return { entry, source, hash: createHash("sha256").update(source).digest("hex") };
});
async function completeSchema(tx) {
  const columns = await tx`select column_name, data_type, is_nullable, is_identity from information_schema.columns
    where table_schema = 'public' and table_name = 'store_drop_signup' order by ordinal_position`;
  const expected = [
    ['id', 'integer', 'NO', 'YES'], ['name', 'text', 'NO', 'NO'], ['phone', 'text', 'NO', 'NO'],
    ['email', 'text', 'NO', 'NO'], ['consent_version', 'text', 'NO', 'NO'],
    ['consent_text', 'text', 'NO', 'NO'], ['consented_at', 'timestamp with time zone', 'NO', 'NO'],
  ];
  if (JSON.stringify(columns.map(row => [row.column_name, row.data_type, row.is_nullable, row.is_identity])) !== JSON.stringify(expected)) return false;
  const constraints = await tx`select conname from pg_constraint where conrelid = 'public.store_drop_signup'::regclass
    and conname in ('store_drop_signup_pkey', 'store_drop_signup_email_unique', 'store_drop_signup_name_check',
      'store_drop_signup_phone_check', 'store_drop_signup_email_check')`;
  const defaults = await tx`select column_default from information_schema.columns where table_schema = 'public'
    and table_name = 'store_drop_signup' and column_name = 'consented_at'`;
  return constraints.length === 5 && defaults[0]?.column_default === 'now()';
}
export async function migrateStoreDrops(sql) {
  if (position !== 6) throw new Error("Migração alvo divergente.");
  const migration = migrations[position];
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout', '5s', true)`;
    await tx`select set_config('statement_timeout', '60s', true)`;
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
    if (!rows.every((row, i) => migrations[i] && row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].entry.when)) throw new Error("Histórico divergente; migração recusada.");
    const [state] = await tx`select to_regclass('public.store_drop_signup') is not null as present`;
    if (rows.length === 7 && state.present && await completeSchema(tx)) return { changed: false, migration: target };
    if (rows.length !== 6 || state.present) throw new Error("Esquema divergente; migração recusada.");
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
  try { console.log(JSON.stringify(await migrateStoreDrops(sql))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração dos drops não concluída. Verifique histórico, esquema, backup e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
