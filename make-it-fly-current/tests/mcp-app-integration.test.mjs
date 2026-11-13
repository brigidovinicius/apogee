import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { mcpTestDatabase } from "./helpers/mcp-test-database.mjs";

test("real Apogee auth, PostgreSQL, code-family hook and MCP transport work together and disconnect", { timeout: 30_000 }, async () => {
  const original = { ...process.env };
  const origin = "https://www.apogee.community", resource = origin + "/mcp", callback = "https://client.synthetic.test/callback";
  Object.assign(process.env, { NODE_ENV: "test", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "synthetic-apogee-mcp-key-at-least-32-characters",
    APOGEE_MCP_ENABLED: "true", RADAR_BILLING_ENABLED: "false", MEMBERS_SUPERVISED_REGISTRATION_ENABLED: "false",
    RADAR_CALENDAR_PERSONAL_ENABLED: "true", RADAR_COLLECTIONS_ENABLED: "true" });
  delete globalThis.__apogeeMembersAuth;
  const database = await mcpTestDatabase({ accountTables: true });
  // Match the app's postgres-js execute return shape; queries/transactions use
  // the real Drizzle PGlite database and real SQL schema.
  const appDb = Object.create(database.db);
  appDb.execute = async query => (await database.db.execute(query)).rows;
  const opportunity = { id: "radar-synthetic", title: "Hackathon sintético", organization: "Instituição", kind: "Programa", level: "Graduação",
    categories: ["competicoes"], location: "SC", stateCode: "SC", cityName: null, summary: "Resumo público", benefit: "Apoio",
    eligibility: "REQUISITO_PRIVADO", officialUrl: "https://source.synthetic.test/private", deadline: "2099-12-31", deadlineLabel: "Até dezembro", verifiedAt: "2026-11-12" };
  const load = opportunityLoader({
    "@/lib/members/db": { getDb: () => appDb, getSql: () => database.sql },
    "./db": { getDb: () => appDb, getSql: () => database.sql },
    "next/cache": { revalidatePath: () => {} },
    "better-auth/next-js": { nextCookies: () => ({ id: "synthetic-next-cookie-context" }) },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => [opportunity] },
    "@/lib/members/mail": { applicationOrigin: () => origin, memberMailAvailable: () => false, sendMemberMail: () => { throw Error("Real mail prohibited"); } },
    "./mail": { applicationOrigin: () => origin, memberMailAvailable: () => false, sendMemberMail: () => { throw Error("Real mail prohibited"); } },
  });
  try {
    const auth = load("lib/members/auth.ts").getAuth(); await auth.$context;
    async function call(path, body, headers = {}) {
      const form = body instanceof URLSearchParams;
      return auth.handler(new Request(origin + "/api/auth" + path, { method: body ? "POST" : "GET", headers: {
        Origin: origin, Accept: "application/json", ...(body ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}), ...headers,
      }, ...(body ? { body: form ? body.toString() : JSON.stringify(body) } : {}) }));
    }
    const signedUp = await call("/sign-up/email", { name: "Pessoa", username: "pessoa", email: "a@synthetic.test", password: "synthetic-password-123" });
    assert.equal(signedUp.status, 200, await signedUp.clone().text());
    const account = await signedUp.json(); const cookie = signedUp.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const registration = await call("/oauth2/register", { client_name: "Cliente sintético", redirect_uris: [callback], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] });
    assert.equal(registration.status, 201, await registration.clone().text()); const client = await registration.json();
    const verifier = randomBytes(32).toString("base64url");
    async function grant(scope = "radar:read offline_access") {
      const params = new URLSearchParams({ response_type: "code", client_id: client.client_id, redirect_uri: callback, resource,
        scope, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "consent" });
      const response = await call("/oauth2/authorize?" + params, undefined, { Cookie: cookie });
      const target = response.headers.get("location") ?? (await response.json()).url;
      const consent = await call("/oauth2/consent", { accept: true, oauth_query: new URL(target, origin).searchParams.toString() }, { Cookie: cookie });
      assert.equal(consent.status, 200, await consent.clone().text());
      const code = new URL((await consent.json()).url).searchParams.get("code"); assert.ok(code);
      const exchanged = await call("/oauth2/token", new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, redirect_uri: callback, code, code_verifier: verifier, resource }));
      assert.equal(exchanged.status, 200, await exchanged.clone().text()); return exchanged.json();
    }
    const first = await grant();
    const families = (await database.pg.query("select * from mcp_oauth_family")).rows;
    assert.equal(families.length, 1); assert.equal(families[0].user_id, account.user.id);
    const authorize = load("lib/mcp/oauth.ts").authorizeMcpRequest;
    const bearer = token => new Request(resource, { method: "POST", headers: { Authorization: "Bearer " + token } });
    assert.equal((await authorize(bearer(first.access_token))).userId, account.user.id);
    const route = load("app/mcp/route.ts");
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      requestInit: { headers: { Authorization: "Bearer " + first.access_token } },
      fetch: (url, init) => { const req = new Request(url, init); return route[req.method](req); },
    });
    const mcp = new Client({ name: "synthetic-client", version: "1.0.0" });
    try {
      await mcp.connect(transport);
      assert.equal((await mcp.listTools()).tools.length, 12);
      const result = await mcp.callTool({ name: "search_opportunities", arguments: { stateCode: "SC" } });
      assert.equal(result.isError, undefined, JSON.stringify(result));
      assert.equal(result.structuredContent.items[0].detailAccess, "locked");
      assert.ok(!JSON.stringify(result).includes("REQUISITO_PRIVADO"));
    } finally { await mcp.close(); }
    await load("lib/mcp/connections.ts").revokeMcpConnection(account.user.id, client.client_id);
    assert.equal(await authorize(bearer(first.access_token)), null);
    const refresh = await call("/oauth2/token", new URLSearchParams({ grant_type: "refresh_token", client_id: client.client_id, refresh_token: first.refresh_token, resource }));
    assert.equal(refresh.status, 400, await refresh.clone().text());
    const reconnected = await grant();
    assert.ok(await authorize(bearer(reconnected.access_token)));
    assert.equal(await authorize(bearer(first.access_token)), null);
    assert.equal((await database.pg.query("select count(*)::int as count from mcp_oauth_family where revoked_at is not null")).rows[0].count, 1);
    const accountGrant = await grant("account:read collections:write offline_access");
    assert.equal((await load("lib/mcp/connections.ts").listMcpConnections(account.user.id))[0].clientId, client.client_id,
      "account-only consents remain visible and revocable");
    await database.sql`insert into radar_legacy_access(user_id) values (${account.user.id})`;
    const accountClient = new Client({ name: "synthetic-account-client", version: "1.0.0" });
    try {
      await accountClient.connect(new StreamableHTTPClientTransport(new URL(resource), {
        requestInit: { headers: { Authorization: "Bearer " + accountGrant.access_token } },
        fetch: (url, init) => { const req = new Request(url, init); return route[req.method](req); },
      }));
      const profile = await accountClient.callTool({ name: "get_account_profile", arguments: {} });
      assert.equal(profile.isError, undefined, JSON.stringify(profile)); assert.equal(profile.structuredContent.username, "pessoa");
      const created = await accountClient.callTool({ name: "create_collection", arguments: { name: "Via OAuth e SDK" } });
      assert.equal(created.isError, undefined, JSON.stringify(created));
      assert.equal((await database.sql`select user_id from radar_calendar_collection where id=${created.structuredContent.id}`)[0].user_id, account.user.id);
      assert.equal((await accountClient.callTool({ name: "set_calendar_opportunity", arguments: { opportunityId: opportunity.id, saved: true } })).isError, true,
        "collections write grant cannot write personal calendar");
      await load("lib/mcp/connections.ts").revokeMcpConnection(account.user.id, client.client_id);
      const rejected = await accountClient.callTool({ name: "list_my_collections", arguments: {} }).catch(() => null);
      assert.ok(!rejected || rejected.isError, "revoked account token cannot read account data");
    } finally { await accountClient.close(); }
  } finally {
    await database.close(); process.env = original; delete globalThis.__apogeeMembersAuth;
  }
});
