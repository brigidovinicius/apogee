import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type MembersDb = PostgresJsDatabase<typeof schema>;

type Cached = { client: postgres.Sql; db: MembersDb };

const globalForDb = globalThis as typeof globalThis & { __apogeeMembersDb?: Cached };

// Conexão preguiçosa: o build na Vercel não precisa do banco, e cada instância
// serverless reutiliza um único cliente. PgBouncer em modo transaction exige
// prepare:false. Com DATABASE_CA_CERT o certificado do servidor é validado.
export function getDb(): MembersDb {
  if (globalForDb.__apogeeMembersDb) return globalForDb.__apogeeMembersDb.db;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada para a área de membros.");

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const client = postgres(url, {
    ssl: ca ? { ca, rejectUnauthorized: true } : "require",
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const db = drizzle(client, { schema });
  globalForDb.__apogeeMembersDb = { client, db };
  return db;
}
