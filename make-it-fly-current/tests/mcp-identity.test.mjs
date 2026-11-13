import assert from "node:assert/strict";
import { test } from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("MCP identity reads the current user and excludes blocked and incomplete identities", async () => {
  let row = { id: "a", name: "Pessoa", username: "pessoa", blocked: false, nameNeedsConfirmation: false };
  const load = opportunityLoader({
    "@/lib/members/db": { getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) }) }) },
  });
  const { getMcpMember } = load("lib/mcp/identity.ts");
  assert.equal((await getMcpMember("a")).id, "a");
  row.blocked = true; assert.equal(await getMcpMember("a"), null);
  row.blocked = false; row.name = "https://example.test";
  assert.equal((await getMcpMember("a")).nameNeedsConfirmation, true);
  row = null; assert.equal(await getMcpMember("a"), null);
});

test("read-only Radar entitlement observes verified pending payment without claiming it", async () => {
  const calls = [];
  const tx = parts => {
    const sql = parts.join("?"); calls.push(sql);
    if (sql.includes('select id, email')) return [{ id: "a", email: "member@example.test", email_verified: true, role: "member", blocked: false }];
    if (sql.includes('radar_legacy_access')) return [];
    if (sql.includes('select session_id')) return [{ session_id: "synthetic" }];
    if (/update|insert|delete/i.test(sql.replace(/for update/gi, ""))) throw Error("Read-only call wrote data");
    return [];
  };
  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => ({ begin: fn => fn(tx) }) } });
  const { radarAccess } = load("lib/billing/store.ts");
  assert.equal((await radarAccess("a", true, { claimPurchases: false })).active, true);
  assert.ok(calls.some(sql => sql.includes('user_id is null')));
  assert.ok(calls.every(sql => !/update radar_purchase/i.test(sql)));
});
