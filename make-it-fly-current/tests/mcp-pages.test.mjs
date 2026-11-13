import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("MCP entry remains public in the member proxy while consent and connections stay protected", () => {
  const load = opportunityLoader({
    "better-auth/cookies": { getSessionCookie: () => null },
    "next/server": { NextResponse: { next: () => ({ next: true }), redirect: url => ({ redirect: String(url) }) } },
  });
  const { proxy } = load("proxy.ts");
  const entry = new URL("https://www.apogee.community/membros/integracoes/mcp/entrar?sig=synthetic");
  assert.equal(proxy({ nextUrl: entry, url: entry.href }).next, true);
  for (const path of ["/membros/integracoes/mcp", "/membros/integracoes/mcp/autorizar"]) {
    const url = new URL(path + "?sig=synthetic", entry.origin);
    const redirect = new URL(proxy({ nextUrl: url, url: url.href }).redirect);
    assert.equal(redirect.pathname, "/membros/entrar"); assert.equal(redirect.searchParams.get("next"), path + "?sig=synthetic");
  }
});

test("MCP login only renders a sign-in form for a verified OAuth request", async () => {
  const load = opportunityLoader({
    "@/lib/mcp/config": { mcpEnabled: () => true },
    "@/lib/mcp/oauth": { verifiedMcpQuery: async params => params.get("sig") === "valid" ? params.toString() : null },
    "@/components/members/mcp-login": { McpLogin: () => React.createElement("form", { "data-mcp-login": true }) },
  });
  const Page = load("app/membros/integracoes/mcp/entrar/page.tsx").default;
  const valid = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ sig: "valid" }) }));
  assert.match(valid, /data-mcp-login/);
  const invalid = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ sig: "forged" }) }));
  assert.doesNotMatch(invalid, /data-mcp-login/); assert.match(invalid, /expirou ou é inválida/);
});

test("MCP consent preserves the signed request through profile completion and displays callback host", async () => {
  const paths = [];
  const query = "client_id=synthetic&scope=radar%3Aread+offline_access&redirect_uri=https%3A%2F%2Fclient.example.test%2Fcallback&sig=valid";
  const load = opportunityLoader({
    "@/lib/mcp/config": { mcpEnabled: () => true },
    "@/lib/mcp/oauth": { verifiedMcpQuery: async () => query },
    "@/lib/members/dal": { requireSignedInMember: async path => { paths.push(path); return { id: "a", username: "pessoa" }; } },
    "@/lib/members/auth": { getAuth: () => ({ api: { getOAuthClientPublic: async () => ({ client_name: "<script>" }) } }) },
    "next/headers": { headers: async () => new Headers() },
    "../actions": { decideMcpConsent: async () => {} },
  });
  const Page = load("app/membros/integracoes/mcp/autorizar/page.tsx").default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.equal(paths[0], "/membros/integracoes/mcp/autorizar?" + query);
  assert.match(html, /client\.example\.test/); assert.match(html, /Autorizar &lt;script&gt;\?/);
  assert.doesNotMatch(html, /<h1[^>]*>Autorizar <script>/);
  assert.match(html, /name="oauth_query"/); assert.match(html, /<button[^>]*value="allow"[^>]*>/);
});
