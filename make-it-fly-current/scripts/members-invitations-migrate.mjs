// Applies only migration 0004 after verifying the complete, reviewed history.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const tags = ["0000_init", "0001_gallery_postgres", "0002_rapid_queen_noir", "0003_bored_logan", "0004_member_invitations"];
const migrations = tags.map(tag => {
  const source = readFileSync(new URL(`${tag}.sql`, root), "utf8");
  return { source, hash: createHash("sha256").update(source).digest("hex"), entry: journal.entries.find(entry => entry.tag === tag) };
});

async function schemaState(tx) {
  const [tables] = await tx`SELECT to_regclass('public."user"') IS NOT NULL AS account,
    to_regclass('public.member_invitation') IS NOT NULL AS invitation,
    to_regclass('public.member_invitation_event') IS NOT NULL AS event`;
  const columns = await tx`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user'
    AND column_name IN ('can_manage_admins', 'blocked', 'name_needs_confirmation')`;
  const complete = tables.account && tables.invitation && tables.event && columns.length === 3
    && columns.every(column => column.data_type === "boolean" && column.is_nullable === "NO" && column.column_default === "false");
  const absent = tables.account && !tables.invitation && !tables.event && columns.length === 0;
  return { complete, absent };
}

export async function migrateMemberInvitations(sql) {
  return sql.begin(async tx => {
    await tx`SELECT set_config('lock_timeout', '5s', true)`;
    await tx`SELECT set_config('statement_timeout', '60s', true)`;
    await tx`LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE`;
    const rows = await tx`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
    if (!migrations.every(item => item.entry) || !rows.every((row, index) => migrations[index]
      && row.hash === migrations[index].hash && Number(row.created_at) === migrations[index].entry.when)) {
      throw new Error("Histórico de migrações divergente; convites não alterados.");
    }
    const state = await schemaState(tx);
    if (rows.length === 5 && state.complete) return { changed: false, migration: tags[4] };
    if (rows.length !== 4 || !state.absent) throw new Error("Esquema divergente; convites não alterados.");
    await tx.unsafe(migrations[4].source);
    if (!(await schemaState(tx)).complete) throw new Error("Esquema de convites incompleto; transação revertida.");
    await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${migrations[4].hash}, ${migrations[4].entry.when})`;
    return { changed: true, migration: tags[4] };
  });
}

async function main() {
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw new Error("A migração operacional exige TLS.");
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateMemberInvitations(sql))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração de convites falhou; confira histórico, esquema, permissões e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
