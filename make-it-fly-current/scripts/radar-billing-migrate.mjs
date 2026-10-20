import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const migrations = journal.entries.map(entry => {
  const source = readFileSync(new URL(`${entry.tag}.sql`, root), "utf8");
  return { entry, source, hash: createHash("sha256").update(source).digest("hex") };
});
const target = "0005_radar_lifetime";

async function completeSchema(tx) {
  const columns = await tx`select table_name, column_name from information_schema.columns
    where table_schema = 'public' and table_name in ('radar_purchase', 'radar_stripe_event', 'radar_legacy_access')`;
  const expected = {
    radar_legacy_access: ['user_id', 'granted_at'],
    radar_stripe_event: ['event_id', 'event_type', 'processed_at'],
    radar_purchase: ['session_id', 'payment_intent_id', 'user_id', 'email', 'price_id', 'product_id', 'amount',
      'currency', 'livemode', 'status', 'provider_event_at', 'recorded_at', 'updated_at'],
  };
  const correct = Object.entries(expected).every(([table, names]) => {
    const actual = columns.filter(column => column.table_name === table).map(column => column.column_name).sort();
    return JSON.stringify(actual) === JSON.stringify([...names].sort());
  });
  const constraints = await tx`select conname from pg_constraint where connamespace = 'public'::regnamespace
    and conname in ('radar_purchase_amount_check', 'radar_purchase_currency_check', 'radar_purchase_status_check',
      'radar_legacy_access_user_id_user_id_fk', 'radar_purchase_user_id_user_id_fk', 'radar_purchase_payment_intent_id_unique')`;
  return correct && constraints.length === 6;
}

export async function migrateRadarBilling(sql) {
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout', '5s', true)`;
    await tx`select set_config('statement_timeout', '60s', true)`;
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash, created_at from drizzle.__drizzle_migrations order by created_at`;
    if (migrations.length !== 6 || migrations[5].entry.tag !== target || !rows.every((row, i) => migrations[i]
      && row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].entry.when)) throw new Error("Histórico divergente; migração recusada.");
    const [state] = await tx`select to_regclass('public.radar_purchase') is not null as purchase,
      to_regclass('public.radar_stripe_event') is not null as event,
      to_regclass('public.radar_legacy_access') is not null as legacy`;
    if (rows.length === 6 && state.purchase && state.event && state.legacy && await completeSchema(tx)) return { changed: false, migration: target };
    if (rows.length !== 5 || state.purchase || state.event || state.legacy) throw new Error("Esquema divergente; migração recusada.");
    await tx.unsafe(migrations[5].source);
    if (!(await completeSchema(tx))) throw new Error("Esquema incompleto; migração revertida.");
    await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${migrations[5].hash}, ${migrations[5].entry.when})`;
    return { changed: true, migration: target };
  });
}

async function main() {
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw new Error("Migração operacional exige TLS.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateRadarBilling(sql))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração do Radar não concluída. Verifique histórico, esquema, backup e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
