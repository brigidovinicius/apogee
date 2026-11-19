// Installs the monthly quota table and its journal entry in one transaction.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const tag = "0024_monthly_detail_unlock";

export async function migrateMonthlyDetails(sql, { apply = false, expectedRole = "apogee_app" } = {}) {
  const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8")).entries;
  const index = journal.findIndex(entry => entry.tag === tag);
  if (index !== 24 || journal[index - 1].tag !== "0023_member_benefit_monitor") throw Error("Sequência de migrações divergente.");
  const migrations = journal.map(entry => {
    const source = readFileSync(new URL(entry.tag + ".sql", root), "utf8");
    return { ...entry, source, hash: createHash("sha256").update(source).digest("hex") };
  });
  const migration = migrations[index];
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true),set_config('statement_timeout','60s',true),set_config('search_path','public,pg_catalog',true)`;
    const [actor] = await tx`select current_user as role`;
    if (actor.role !== expectedRole) throw Error("Papel divergente.");
    await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
    const rows = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    if (rows.length < index || rows.length > migrations.length ||
        !rows.every((row, i) => row.hash === migrations[i].hash && Number(row.created_at) === migrations[i].when)) {
      throw Error("Histórico de migrações divergente.");
    }
    const installed = rows.length > index;
    const [relation] = await tx`select to_regclass('public.member_monthly_detail_unlock') is not null as present`;
    if (relation.present !== installed) throw Error("Tabela e histórico de migrações divergentes.");
    if (!installed && !apply) return { changed: false, pending: true };
    if (!installed) await tx.unsafe(migration.source);
    const [schema] = await tx`select tableowner=current_user as owned,
        (select array_agg(column_name::text || ':' || data_type || ':' || is_nullable order by ordinal_position)
          from information_schema.columns where table_schema='public' and table_name=t.tablename) as columns,
        (select array_agg(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.member_monthly_detail_unlock'::regclass) as constraints
      from pg_tables t where schemaname='public' and tablename='member_monthly_detail_unlock'`;
    const columns = ["user_id:text:NO", "area:text:NO", "period:date:NO", "item_id:text:NO", "opened_at:timestamp with time zone:NO"];
    const constraints = ["PRIMARY KEY (user_id, area, period, item_id)", 'REFERENCES "user"(id) ON DELETE CASCADE',
      "'radar'::text, 'beneficios'::text", "EXTRACT(day FROM period) =", "^[A-Za-z0-9_-]{1,200}$"];
    if (!schema?.owned || schema.columns.join(",") !== columns.join(",") || schema.constraints.length !== constraints.length ||
        !constraints.every(fragment => schema.constraints.some(definition => definition.includes(fragment)))) throw Error("Estrutura das cotas divergente.");
    if (!installed) await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${migration.hash},${migration.when})`;
    return { changed: !installed, pending: false };
  });
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw Error("Argumento inválido.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("TLS obrigatório.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMonthlyDetails(sql, { apply: process.argv.includes("--apply") }))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error("Migração das cotas não concluída.", error.code ?? "");
  process.exitCode = 1;
});
