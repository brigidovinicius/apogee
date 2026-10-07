import { readFile, readdir } from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();
try {
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const files = (await readdir(new URL("../db/migrations/", import.meta.url))).filter((name) => name.endsWith(".sql")).sort();
  for (const name of files) {
    const exists = await client.query("select 1 from schema_migrations where name=$1", [name]);
    if (exists.rowCount) continue;
    const sql = await readFile(new URL(`../db/migrations/${name}`, import.meta.url), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations(name) values($1)", [name]);
      await client.query("commit");
      console.log(`applied ${name}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}