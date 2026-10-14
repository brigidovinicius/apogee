// Applies only the reviewed member avatar migration after checking Drizzle history.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const tags = ["0000_init", "0001_gallery_postgres", "0002_rapid_queen_noir", "0003_bored_logan"];
const migrations = tags.map(tag => ({
  tag,
  entry: journal.entries.find(entry => entry.tag === tag),
  sql: readFileSync(new URL(`${tag}.sql`, root), "utf8"),
}));
const hash = value => createHash("sha256").update(value).digest("hex");

export async function migrateMemberAvatar(sql) {
  return sql.begin(async tx => {
    await tx`LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE`;
    const rows = await tx`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
    const tables = await tx`SELECT to_regclass('public.member_avatar') IS NOT NULL AS avatar`;
    const validPrefix = rows.every((row, index) => migrations[index]
      && row.hash === hash(migrations[index].sql)
      && Number(row.created_at) === migrations[index].entry?.when);
    if (!validPrefix || !migrations.every(item => item.entry)) {
      throw new Error("Histórico de migrações divergente; avatar não alterado.");
    }
    if (rows.length === 4 && tables[0].avatar) {
      return { changed: false, migration: tags[3] };
    }
    if (rows.length !== 3 || tables[0].avatar) {
      throw new Error("Esquema divergente; avatar não alterado.");
    }
    await tx.unsafe(migrations[3].sql);
    await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash(migrations[3].sql)}, ${migrations[3].entry.when})`;
    return { changed: true, migration: tags[3] };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Conexão PostgreSQL ausente.");
  const ca = process.env.DATABASE_CA_CERT_FILE
    ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
    : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") {
    throw new Error("A migração operacional exige TLS.");
  }
  const sql = postgres(process.env.DATABASE_URL, {
    ssl: ca ? { ca, rejectUnauthorized: true } : "require",
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });
  try {
    console.log(JSON.stringify(await migrateMemberAvatar(sql)));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração do avatar falhou; confira histórico, permissões e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
