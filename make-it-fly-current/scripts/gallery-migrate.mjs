// Migração aditiva e estreita: cria somente gallery_photo e registra no Drizzle.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";

const root = new URL("../drizzle/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", root), "utf8"));
const initial = readFileSync(new URL("0000_init.sql", root), "utf8");
const entry = journal.entries.find(entry => entry.tag === "0001_gallery_postgres");
const migration = readFileSync(new URL("0001_gallery_postgres.sql", root), "utf8");
const hash = value => createHash("sha256").update(value).digest("hex");

export async function migrateGallery(sql) {
  return sql.begin(async tx => {
    await tx`LOCK TABLE drizzle.__drizzle_migrations IN EXCLUSIVE MODE`;
    const rows = await tx`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
    const present = await tx`SELECT to_regclass('public.gallery_photo') IS NOT NULL AS present`;
    if (rows.length === 2 && rows[0].hash === hash(initial) && rows[1].hash === hash(migration) && Number(rows[1].created_at) === entry.when && present[0].present) {
      return { changed: false, migration: entry.tag };
    }
    if (rows.length !== 1 || rows[0].hash !== hash(initial) || present[0].present || Number(rows[0].created_at) >= entry.when) {
      throw new Error("Histórico ou tabela divergente; migração cancelada sem alterações.");
    }
    // SQL revisado empacotado com a revisão; nenhuma entrada do usuário.
    await tx.unsafe(migration);
    await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash(migration)}, ${entry.when})`;
    return { changed: true, migration: entry.tag };
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Conexão PostgreSQL ausente.");
  const ca = process.env.DATABASE_CA_CERT_FILE ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8") : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw new Error("A migração operacional exige TLS.");
  const sql = postgres(process.env.DATABASE_URL, { ssl: ca ? { ca, rejectUnauthorized: true } : "require", prepare: false, max: 1, connect_timeout: 10 });
  try { console.log(JSON.stringify(await migrateGallery(sql))); } finally { await sql.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Migração da galeria falhou; confira histórico, permissões e conexão. Nenhum segredo foi exibido.");
  process.exitCode = 1;
});
