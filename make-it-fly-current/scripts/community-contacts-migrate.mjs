import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const source = readFileSync(new URL("../sql/community-contacts.sql", import.meta.url), "utf8");
const expected = [
  ["id", "uuid", "NO"], ["campaign", "text", "NO"], ["name", "text", "NO"],
  ["email", "text", "NO"], ["goal", "text", "NO"], ["consent_version", "text", "NO"],
  ["consent_text", "text", "NO"], ["consented_at", "timestamp with time zone", "NO"],
];
async function verify(tx) {
  const columns = await tx`select column_name, data_type, is_nullable from information_schema.columns
    where table_schema='public' and table_name='community_contact' order by ordinal_position`;
  const [state] = await tx`select count(*)::int as constraints from pg_constraint
    where conrelid='public.community_contact'::regclass and contype in ('p','u','c')`;
  if (JSON.stringify(columns.map(row => [row.column_name, row.data_type, row.is_nullable])) !== JSON.stringify(expected) || state.constraints !== 6) {
    throw new Error("Esquema de contatos divergente.");
  }
}

export async function migrateCommunityContacts(sql) {
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','30s',true)`;
    await tx`select pg_advisory_xact_lock(hashtext('apogee-community-contact-v1'))`;
    const [state] = await tx`select to_regclass('public.community_contact') is not null as present`;
    if (!state.present) await tx.unsafe(source);
    await verify(tx);
    return { changed: !state.present, table: "community_contact" };
  });
}

async function main() {
  if (process.env.COMMUNITY_CONTACTS_MIGRATION_APPROVED !== "true") throw new Error("Autorização de banco pendente.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, options);
  try { console.log(JSON.stringify(await migrateCommunityContacts(sql))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração de contatos não concluída. Confira autorização, backup, conexão e esquema. Nenhum dado de contato foi exibido.");
  process.exitCode = 1;
});
