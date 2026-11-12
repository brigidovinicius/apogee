import assert from "node:assert/strict";
import test from "node:test";
import postgres from "postgres";
import { migrateCommunityContacts } from "../scripts/community-contacts-migrate.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const url = process.env.COMMUNITY_CONTACTS_TEST_DATABASE_URL;
test("contact migration is idempotent and duplicate requests preserve original consent", { skip: !url }, async () => {
  const target = new URL(url);
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.pathname, "/apogee_gallery_ci");
  const sql = postgres(url, { ssl: false, prepare: false, max: 1 });
  try {
    const existing = await sql`select count(*)::int as total from public."user"`;
    assert.deepEqual(await migrateCommunityContacts(sql), { changed: true, table: "community_contact" });
    assert.deepEqual(await migrateCommunityContacts(sql), { changed: false, table: "community_contact" });
    const load = opportunityLoader({
      "@/lib/members/db": { getSql: () => sql },
      "@/lib/members/client-ip": { memberClientIp: () => "127.0.0.1" },
      "@/lib/members/rate-limit": { consumeRateLimit: async () => true },
    });
    const previous = process.env.BETTER_AUTH_SECRET;
    process.env.BETTER_AUTH_SECRET = "s".repeat(32);
    try {
      const { POST } = load("app/api/comunidade/contatos/route.ts");
      const request = name => new Request("https://www.apogee.community/api/comunidade/contatos", { method: "POST", headers: { origin: "https://www.apogee.community", "content-type": "application/json" }, body: JSON.stringify({ campaign: "codex", name, email: "synthetic@example.test", consent: true }) });
      assert.equal((await POST(request("Pessoa Sintética"))).status, 200);
      assert.equal((await POST(request("Pessoa Diferente"))).status, 200);
      const rows = await sql`select name,email,consent_text,consent_version from community_contact`;
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, "Pessoa Sintética");
      assert.equal(rows[0].consent_version, "2026-11-12-v1");
      assert.match(rows[0].consent_text, /Codex Community/);
      assert.deepEqual(await sql`select count(*)::int as total from public."user"`, existing);
    } finally {
      if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
      else process.env.BETTER_AUTH_SECRET = previous;
    }
  } finally { await sql.end(); }
});
