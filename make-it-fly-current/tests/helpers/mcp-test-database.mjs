import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { opportunityLoader } from "./load-opportunity-module.mjs";

// In-memory PostgreSQL only; no URL, sockets, credentials or environment DB lookup.
export async function mcpTestDatabase() {
  const pg = await PGlite.create();
  await pg.exec(await readFile(new URL("../../drizzle/0000_init.sql", import.meta.url), "utf8"));
  await pg.exec(`alter table "user" add column can_manage_admins boolean not null default false,
    add column blocked boolean not null default false, add column name_needs_confirmation boolean not null default false,
    add column adult_declared boolean not null default false;
    create table radar_legacy_access(user_id text primary key references "user"(id));
    create table radar_purchase(session_id text primary key, user_id text references "user"(id), email text,
      livemode boolean not null, status text not null, updated_at timestamptz default now());`);
  await pg.exec(await readFile(new URL("../../drizzle/0016_mcp_oauth.sql", import.meta.url), "utf8"));
  await pg.exec(await readFile(new URL("../../drizzle/0007_radar_free_opportunity.sql", import.meta.url), "utf8"));
  const load = opportunityLoader();
  const schema = { ...load("lib/members/schema.ts"), ...load("lib/mcp/schema.ts") };
  const db = drizzle(pg, { schema });
  function tagged(connection) {
    const sql = async (parts, ...values) => {
      const query = parts.reduce((text, part, i) => text + (i ? `$${i}` : "") + part, "");
      return (await connection.query(query, values)).rows;
    };
    sql.begin = fn => pg.transaction(tx => fn(tagged(tx)));
    return sql;
  }
  const sql = tagged(pg);
  return { pg, sql, db, schema, close: () => pg.close() };
}
