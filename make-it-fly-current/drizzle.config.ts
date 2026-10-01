import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

const ca = process.env.DATABASE_CA_CERT_FILE
  ? readFileSync(process.env.DATABASE_CA_CERT_FILE, "utf8")
  : process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/apogee_membros");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/members/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    ssl: ca ? { ca, rejectUnauthorized: true } : "require",
  },
  strict: true,
  verbose: true,
});
