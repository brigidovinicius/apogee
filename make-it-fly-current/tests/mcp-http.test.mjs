import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function fixture() {
  const state = { enabled: true, allowed: true, identity: { userId: "a", clientId: "synthetic-client", scopes: ["radar:read"] }, calls: [] };
  const load = opportunityLoader({
    "@/lib/mcp/config": { mcpEnabled: () => state.enabled, mcpResource: () => "https://www.apogee.community/mcp", MCP_SCOPE: "radar:read",
      MCP_DEFAULT_SCOPES: ["radar:read", "account:read", "offline_access"], mcpMetadataUrl: () => "https://www.apogee.community/.well-known/oauth-protected-resource/mcp",
      MCP_SCOPES: ["radar:read", "account:read", "calendar:write", "collections:write"], mcpIssuer: () => "https://www.apogee.community/api/auth" },
    "@/lib/mcp/oauth": { authorizeMcpRequest: async req => req.headers.get("authorization") === "Bearer synthetic"
      ? state.identity : null },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => state.allowed },
    "@/lib/members/client-ip": { memberClientIp: () => "198.51.100.11" },
    "@/lib/members/mail": { applicationOrigin: () => "https://www.apogee.community" },
    "./account": { runAccountTool: async (id, tool, args) => { state.calls.push({ id, tool, args }); return { updated: true }; } },
    "@/lib/mcp/radar": { readRadarTool: async (id, tool, args) => {
      state.calls.push({ id, tool, args }); return { items: [{ id: "radar-synthetic", title: "Oportunidade sintética" }] };
    } },
  });
  return { state, route: () => load("app/mcp/route.ts"), metadata: () => load("app/.well-known/oauth-protected-resource/mcp/route.ts") };
}
function request(body, extra = {}) {
  return new Request("https://www.apogee.community/mcp", { method: "POST", headers: {
    "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...extra,
  }, body: JSON.stringify(body) });
}
test("MCP requires Bearer authentication rather than a member cookie", async () => {
  const { route } = fixture();
  const response = await route().POST(request({ jsonrpc: "2.0", id: 1, method: "tools/list" }, { Cookie: "session=synthetic" }));
  assert.equal(response.status, 401); assert.match(response.headers.get("www-authenticate"), /oauth-protected-resource/);
  assert.match(response.headers.get("www-authenticate"), /radar:read/);
  assert.match(response.headers.get("www-authenticate"), /account:read/);
  assert.doesNotMatch(response.headers.get("www-authenticate"), /:write/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("MCP disabled flag returns 404 without authenticating or loading a catalogue", async () => {
  const { route, state } = fixture(); state.enabled = false;
  assert.equal((await route().POST(request({}))).status, 404); assert.equal(state.calls.length, 0);
});
test("official MCP client preserves old Radar grants and enforces additional scopes before account calls", async () => {
  const { route, state } = fixture();
  const transport = new StreamableHTTPClientTransport(new URL("https://www.apogee.community/mcp"), {
    requestInit: { headers: { Authorization: "Bearer synthetic" } },
    fetch: (url, init) => {
      const req = new Request(url, init); const handler = route()[req.method];
      return handler ? handler(req) : new Response(null, { status: 405 });
    },
  });
  const client = new Client({ name: "apogee-synthetic", version: "1.0.0" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(tools.length, 12);
    assert.ok(tools.filter(t => ["get_opportunity", "get_radar_access", "list_calendar_entries", "search_opportunities"].includes(t.name))
      .every(t => t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false));
    const create = tools.find(t => t.name === "create_collection");
    assert.equal(create.annotations.readOnlyHint, false); assert.equal(create.annotations.idempotentHint, false);
    assert.deepEqual(create._meta.securitySchemes[0].scopes, ["account:read", "collections:write"]);
    assert.equal(tools.find(t => t.name === "set_calendar_opportunity").annotations.destructiveHint, true);
    const denied = await client.callTool({ name: "create_collection", arguments: { name: "Minha coleção" } });
    assert.equal(denied.isError, true); assert.equal(denied.structuredContent.error, "insufficient_scope");
    assert.match(denied._meta["mcp/www_authenticate"][0], /collections:write/); assert.equal(state.calls.length, 0);
    const readDenied = await client.callTool({ name: "get_account_profile", arguments: {} });
    assert.equal(readDenied.isError, true); assert.equal(state.calls.length, 0);
    const result = await client.callTool({ name: "search_opportunities", arguments: { query: "tecnologia" } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.items[0].id, "radar-synthetic");
    assert.deepEqual(state.calls[0], { id: "a", tool: "search_opportunities", args: { query: "tecnologia" } });
    const forbidden = await client.callTool({ name: "search_opportunities", arguments: { userId: "b" } });
    assert.equal(forbidden.isError, true); assert.equal(state.calls.length, 1);
    state.identity.scopes = ["account:read", "collections:write"];
    const written = await client.callTool({ name: "create_collection", arguments: { name: "Minha coleção" } });
    assert.equal(written.isError, undefined); assert.equal(state.calls[1].id, "a");
    const radarDenied = await client.callTool({ name: "get_radar_access", arguments: {} });
    assert.equal(radarDenied.isError, true); assert.equal(state.calls.length, 2);
  } finally { await client.close(); }
});
test("MCP rejects oversized bodies, foreign origins and account quota exhaustion", async () => {
  const { route, state } = fixture();
  const header = { Authorization: "Bearer synthetic" };
  assert.equal((await route().POST(request({}, { ...header, Origin: "https://evil.example" }))).status, 403);
  assert.equal((await route().POST(request({ data: "a".repeat(70_000) }, header))).status, 413);
  state.allowed = false;
  assert.equal((await route().POST(request({}, header))).status, 429);
});
test("MCP metadata advertises refresh access without wildcard credential CORS", async () => {
  const { route, metadata } = fixture(); const response = await route().OPTIONS(new Request("https://www.apogee.community/mcp", { method: "OPTIONS", headers: { Origin: "https://chatgpt.com" } }));
  assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.match(response.headers.get("access-control-expose-headers"), /WWW-Authenticate/i);
  const advertised = await metadata().GET().json();
  assert.ok(advertised.scopes_supported.includes("offline_access"), "connection builders must discover refresh access before tool discovery");
});
