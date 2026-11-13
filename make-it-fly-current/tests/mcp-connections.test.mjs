import assert from "node:assert/strict";
import { test } from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("disconnect deletes access, refresh and consent only for the authenticated account and client", async () => {
  const calls = [];
  const tx = async (parts, ...args) => {
    const statement = parts.join("?"); calls.push({ statement, args });
    if (statement.startsWith('select id from "user"')) return [{ id: "account-a" }];
    return [];
  };
  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => ({ begin: fn => fn(tx) }) } });
  await load("lib/mcp/connections.ts").revokeMcpConnection("account-a", "client-a");
  const deletes = calls.filter(c => c.statement.startsWith("delete"));
  assert.equal(deletes.length, 3);
  assert.deepEqual(deletes.map(c => c.statement.match(/delete from (\w+)/)[1]), ["mcp_oauth_access_token", "mcp_oauth_refresh_token", "mcp_oauth_consent"]);
  for (const entry of deletes) {
    assert.match(entry.statement, /where user_id = \? and client_id = \?/);
    assert.deepEqual(entry.args, ["account-a", "client-a"]);
  }
});
test("disconnect from a blocked account refuses before deleting any grant", async () => {
  let deletes = 0;
  const tx = async parts => { if (parts.join("").startsWith("delete")) deletes++; return []; };
  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => ({ begin: fn => fn(tx) }) } });
  await assert.rejects(load("lib/mcp/connections.ts").revokeMcpConnection("account-a", "client-a"), /Conta indisponível/);
  assert.equal(deletes, 0);
});
test("disconnect action refuses foreign Origin and cannot choose a different user identity", async () => {
  let origin = "https://evil.example", revoked;
  const load = opportunityLoader({
    "next/headers": { headers: async () => new Headers({ Origin: origin }) },
    "next/navigation": { redirect: path => { throw Error("REDIRECT:" + path); }, notFound: () => { throw Error("NOT_FOUND"); } },
    "@/lib/members/auth": { getAuth: () => ({}) },
    "@/lib/members/dal": { requireSignedInMember: async () => ({ id: "account-a" }) },
    "@/lib/members/mail": { applicationOrigin: () => "https://www.apogee.community" },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => true },
    "@/lib/mcp/config": { mcpEnabled: () => true },
    "@/lib/mcp/oauth": {},
    "@/lib/mcp/connections": { revokeMcpConnection: async (...args) => { revoked = args; } },
  });
  const action = load("app/membros/integracoes/mcp/actions.ts").disconnectMcp;
  const form = new FormData(); form.set("clientId", "client-a"); form.set("userId", "account-b");
  await assert.rejects(action(form), /Solicitação inválida/); assert.equal(revoked, undefined);
  origin = "https://www.apogee.community";
  await assert.rejects(action(form), /REDIRECT:/); assert.deepEqual(revoked, ["account-a", "client-a"]);
});
