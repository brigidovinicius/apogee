import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrateStoreDrops } from "../scripts/store-drops-migrate.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const url = process.env.RADAR_BILLING_TEST_DATABASE_URL;
if (process.env.CI !== "true" || url !== "postgres://billing_test:synthetic_ci_only@127.0.0.1:5432/apogee_billing_ci") throw new Error("Use somente o PostgreSQL descartável do CI, após a suíte de billing.");
const sql = postgres(url, { ssl: false, max: 1 });

test("drop migration and public signup persist contacts and consent on real disposable PostgreSQL", async () => {
  try {
    const [{ count: usersBefore }] = await sql`select count(*) from public."user"`;
    assert.deepEqual(await migrateStoreDrops(sql), { changed: true, migration: "0006_store_drop_signups" });
    assert.equal((await migrateStoreDrops(sql)).changed, false);
    Object.assign(process.env, { APPLICATION_HOSTING_PROVIDER: "caddy", BETTER_AUTH_SECRET: "store-drops-disposable-ci-secret-at-least-32" });
    const load = opportunityLoader({ "@/lib/members/db": { getSql: () => sql, getDb: () => drizzle(sql) } });
    const { POST } = load("app/api/loja/novidades/route.ts");
    const origin = "https://www.apogee.community";
    const request = patch => new Request(`${origin}/api/loja/novidades`, { method: "POST", headers: { origin, "content-type": "application/json", "x-apogee-client-ip": "192.0.2.123" }, body: JSON.stringify({ name: "  Synthetic Drop  ", phone: "+55 (11) 99999-1234", email: " SYNTHETIC-DROP@example.test ", consent: true, website: "", ...patch }) });
    assert.equal((await POST(request({ consent: false }))).status, 400);
    assert.equal((await sql`select count(*) from store_drop_signup`)[0].count, "0");
    assert.equal((await POST(request({}))).status, 200);
    const [row] = await sql`select * from store_drop_signup`;
    assert.equal(row.name, "Synthetic Drop"); assert.equal(row.phone, "+5511999991234"); assert.equal(row.email, "synthetic-drop@example.test");
    assert.equal(row.consent_version, "drops-v1"); assert.match(row.consent_text, /Autorizo a Apogee/); assert.ok(row.consented_at instanceof Date);
    assert.equal((await POST(request({ name: "Other Person", phone: "11911112222" }))).status, 200);
    const [preserved] = await sql`select name,phone from store_drop_signup`;
    assert.deepEqual({ ...preserved }, { name: row.name, phone: row.phone });
    assert.equal((await sql`select count(*) from store_drop_signup`)[0].count, "1");
    assert.equal((await POST(request({}))).status, 200);
    assert.equal((await POST(request({}))).status, 429);
    assert.equal((await sql`select count(*) from public."user"`)[0].count, usersBefore);
    await assert.rejects(sql`insert into store_drop_signup (name,phone,email,consent_version,consent_text) values ('Invalid','123','invalid@example.test','drops-v1','test')`);
    await sql`update drizzle.__drizzle_migrations set hash = 'invalid' where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`;
    await assert.rejects(migrateStoreDrops(sql), /Histórico divergente/);
  } finally { await sql.end(); }
});
