import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { migrateMcpOAuth } from "../scripts/mcp-oauth-migrate.mjs";
import { mcpTestDatabase } from "./helpers/mcp-test-database.mjs";

test("narrow MCP migrator dry-runs, applies once as app owner, and refuses drift", { timeout: 30_000 }, async () => {
  const database = await mcpTestDatabase();
  try {
    // Isolated in-memory database only; no network or production credentials.
    await database.pg.exec(`drop table mcp_oauth_client cascade; drop table mcp_oauth_resource cascade;
      drop table mcp_oauth_client_resource; drop table mcp_oauth_refresh_token cascade;
      drop table mcp_oauth_access_token; drop table mcp_oauth_consent; drop table mcp_oauth_client_assertion; drop table mcp_oauth_family;
      create role apogee_app; grant usage,create on schema public to apogee_app;
      grant references on "user","session" to apogee_app;
      create schema drizzle authorization apogee_app;
      create table drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint);
      alter table drizzle.__drizzle_migrations owner to apogee_app;`);
    const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    for (const entry of journal.entries.slice(0,16)) {
      const source = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
      await database.sql`insert into drizzle.__drizzle_migrations(hash,created_at) values (${createHash("sha256").update(source).digest("hex")},${entry.when})`;
    }
    await database.pg.exec("set role apogee_app");
    assert.deepEqual(await migrateMcpOAuth(database.sql), { changed: false, pending: true, migration: "0016_mcp_oauth", newTables: 8 });
    assert.equal((await migrateMcpOAuth(database.sql, { apply: true })).changed, true);
    assert.equal((await migrateMcpOAuth(database.sql, { apply: true })).changed, false);
    assert.equal((await database.sql`select count(*)::int as n from drizzle.__drizzle_migrations`)[0].n, 17);
    await database.sql`update drizzle.__drizzle_migrations set hash='drift' where id=1`;
    await assert.rejects(migrateMcpOAuth(database.sql, { apply: true }), /Histórico divergente/);
  } finally { await database.close(); }
});
