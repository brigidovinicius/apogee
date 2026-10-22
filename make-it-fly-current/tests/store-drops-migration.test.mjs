import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import { migrateStoreDrops } from "../scripts/store-drops-migrate.mjs";

const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
const history = journal.entries.slice(0, 7).map(entry => ({ hash: createHash("sha256").update(readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url))).digest("hex"), created_at: entry.when }));
const names = ["id", "name", "phone", "email", "consent_version", "consent_text", "consented_at"];
function database({ rows = history.slice(0, 6), present = false, broken = false } = {}) {
  let applied = false, recorded = false;
  async function tx(parts) {
    const query = parts.join("?");
    if (query.includes("select hash, created_at")) return rows;
    if (query.includes("to_regclass")) return [{ present }];
    if (query.includes("column_name, data_type")) return names.map(name => ({ column_name: name, data_type: name === "id" ? "integer" : name === "consented_at" ? "timestamp with time zone" : "text", is_nullable: "NO", is_identity: name === "id" ? "YES" : "NO" }));
    if (query.includes("pg_constraint")) return Array.from({ length: broken ? 4 : 5 }, () => ({}));
    if (query.includes("column_default")) return [{ column_default: "now()" }];
    if (query.includes("insert into drizzle")) recorded = true;
    return [];
  }
  tx.unsafe = async source => { assert.match(source, /^CREATE TABLE "store_drop_signup"/); applied = true; };
  return { sql: { begin: async fn => fn(tx) }, state: () => ({ applied, recorded }) };
}
test("store migration creates only its table after the exact prior history", async () => {
  const db = database();
  assert.deepEqual(await migrateStoreDrops(db.sql), { changed: true, migration: "0006_store_drop_signups" });
  assert.deepEqual(db.state(), { applied: true, recorded: true });
});
test("completed migration is idempotent", async () => {
  const db = database({ rows: history, present: true });
  assert.deepEqual(await migrateStoreDrops(db.sql), { changed: false, migration: "0006_store_drop_signups" });
  assert.deepEqual(db.state(), { applied: false, recorded: false });
});
test("store migration rejects incomplete or divergent history and untracked tables", async () => {
  for (const options of [{ rows: history.slice(0, 5) }, { rows: [{ hash: "wrong", created_at: 1 }] }, { present: true }]) {
    const db = database(options);
    await assert.rejects(migrateStoreDrops(db.sql), /divergente/);
    assert.deepEqual(db.state(), { applied: false, recorded: false });
  }
});
test("incomplete resulting schema aborts before migration history is recorded", async () => {
  const db = database({ broken: true });
  await assert.rejects(migrateStoreDrops(db.sql), /incompleto/);
  assert.equal(db.state().recorded, false);
});
