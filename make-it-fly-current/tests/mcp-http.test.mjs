import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function fixture() {
  const state = { enabled: true, allowed: true, identity: { userId: "a", clientId: "synthetic-client" }, calls: [] };
  const load = opportunityLoader({
    "@/lib/mcp/config": { mcpEnabled: () => state.enabled, mcpResource: () => "https://www.apogee.community/mcp", MCP_SCOPE: "radar:read" },
    "@/lib/mcp/oauth": { authorizeMcpRequest: async req => req.headers.get("authorization") === "Bearer synthetic"
      ? state.identity : null },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => state.allowed },
    "@/lib/members/client-ip": { memberClientIp: () => "198.51.100.11" },
    "@/lib/members/mail": { applicationOrigin: () => "https://www.apogee.community" },
    "@/lib/mcp/radar": { readRadarTool: async (id, tool, args) => {
      state.calls.push({ id, tool, args }); return { items: [{ id: "radar-synthetic", title: "Oportunidade sintética" }] };
    } },
  });
  return { state, route: () => load("app/mcp/route.ts") };
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
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("MCP disabled flag returns 404 without authenticating or loading a catalogue", async () => {
  const { route, state } = fixture(); state.enabled = false;
  assert.equal((await route().POST(request({}))).status, 404); assert.equal(state.calls.length, 0);
});
test("official MCP client can initialize, list four read-only tools and call them", async () => {
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
    assert.deepEqual(tools.map(t => t.name).sort(), ["get_opportunity", "get_radar_access", "list_calendar_entries", "search_opportunities"]);
    assert.ok(tools.every(t => t.annotations.readOnlyHint === true && t.annotations.destructiveHint === false));
    const result = await client.callTool({ name: "search_opportunities", arguments: { query: "tecnologia" } });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent.items[0].id, "radar-synthetic");
    assert.deepEqual(state.calls[0], { id: "a", tool: "search_opportunities", args: { query: "tecnologia" } });
    const forbidden = await client.callTool({ name: "search_opportunities", arguments: { userId: "b" } });
    assert.equal(forbidden.isError, true); assert.equal(state.calls.length, 1);
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
test("MCP metadata and token challenges are public without wildcard credential CORS", async () => {
  const { route } = fixture(); const response = await route().OPTIONS(new Request("https://www.apogee.community/mcp", { method: "OPTIONS", headers: { Origin: "https://chatgpt.com" } }));
  assert.equal(response.status, 204); assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.match(response.headers.get("access-control-expose-headers"), /WWW-Authenticate/i);
});
