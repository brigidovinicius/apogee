import "server-only";
import { readFileSync } from "node:fs";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type MembersDb = PostgresJsDatabase<typeof schema>;

type Cached = { client: postgres.Sql; db: MembersDb };

const globalForDb = globalThis as typeof globalThis & { __apogeeMembersDb?: Cached };

// Conexão preguiçosa: o build na Vercel não precisa do banco, e cada instância
// serverless reutiliza um único cliente. PgBouncer em modo transaction exige
// prepare:false. Com DATABASE_CA_CERT ou DATABASE_CA_CERT_FILE o certificado
// do servidor é validado.
export function getDb(): MembersDb {
  if (globalForDb.__apogeeMembersDb) return globalForDb.__apogeeMembersDb.db;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada para a área de membros.");

  const ca = process.env.DATABASE_CA_CERT_FILE
    ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
    : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const sslMode = process.env.DATABASE_SSL_MODE;
  if (sslMode && sslMode !== "disable" && sslMode !== "require") {
    throw new Error("DATABASE_SSL_MODE deve ser 'disable' ou 'require'.");
  }
  const client = postgres(url, {
    // Produção continua exigindo TLS. O desligamento só é possível quando
    // explicitamente solicitado para um banco local de desenvolvimento.
    ssl: ca ? { ca, rejectUnauthorized: true } : sslMode === "disable" ? false : "require",
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });
  globalForDb.__apogeeMembersDb = { client, db };
  return db;
}
