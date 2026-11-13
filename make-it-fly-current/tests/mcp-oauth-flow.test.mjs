import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { oauthProvider } from "@better-auth/oauth-provider";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const origin = "https://www.apogee.community";
const resource = origin + "/mcp";
const callback = "https://client.example.test/callback";

async function fixture() {
  let auth;
  const load = opportunityLoader({
    "@/lib/members/mail": { applicationOrigin: () => origin },
    "@/lib/members/auth": { getAuth: () => auth },
    "@/lib/mcp/identity": { getMcpMember: async id => ({ id, name: "Pessoa", username: "pessoa", nameNeedsConfirmation: false }) },
    // The database-backed family policy is exercised in mcp-database.test.mjs.
    "@/lib/mcp/families": { mcpTokenFamilyActive: async () => true },
  });
  const options = load("lib/mcp/oauth-config.ts").mcpOAuthOptions();
  const plugin = oauthProvider(options);
  const store = Object.fromEntries(["user", "session", "account", "verification", "rateLimit", ...Object.keys(plugin.schema)].map(key => [key, []]));
  auth = betterAuth({ baseURL: origin, secret: "synthetic-mcp-secret-at-least-32-characters-long", trustedOrigins: [origin],
    database: memoryAdapter(store), emailAndPassword: { enabled: true }, plugins: [plugin],
  });
  await auth.$context;
  async function call(path, body, headers = {}) {
    const form = body instanceof URLSearchParams;
    return auth.handler(new Request(origin + "/api/auth" + path, {
      method: body ? "POST" : "GET", headers: { Origin: origin, Accept: "application/json", ...(body ? { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" } : {}), ...headers },
      ...(body ? { body: form ? body.toString() : JSON.stringify(body) } : {}),
    }));
  }
  const signUp = await call("/sign-up/email", { name: "Pessoa", email: "person@synthetic.test", password: "synthetic-password-123" });
  assert.equal(signUp.status, 200);
  const cookie = signUp.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const account = await signUp.json();
  const registered = await call("/oauth2/register", { client_name: "Cliente sintético", redirect_uris: [callback], token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
  assert.equal(registered.status, 201, await registered.clone().text());
  const client = await registered.json();
  const verifier = randomBytes(32).toString("base64url");
  const authorizeParams = new URLSearchParams({ client_id: client.client_id, redirect_uri: callback, response_type: "code",
    scope: "radar:read offline_access", resource, state: "synthetic-state", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
  async function consent(params = authorizeParams) {
    const response = await call("/oauth2/authorize?" + params, undefined, { Cookie: cookie });
    const target = response.headers.get("location") ?? (await response.json()).url;
    assert.ok(target.includes("/membros/integracoes/mcp/autorizar"), target);
    const approved = await call("/oauth2/consent", { accept: true, oauth_query: new URL(target, origin).searchParams.toString() }, { Cookie: cookie });
    assert.equal(approved.status, 200, await approved.clone().text());
    const redirect = new URL((await approved.json()).url);
    assert.equal(redirect.origin, new URL(callback).origin); assert.equal(redirect.searchParams.get("state"), "synthetic-state");
    return redirect.searchParams.get("code");
  }
  async function exchange(code, override = {}) {
    return call("/oauth2/token", new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id,
      code, code_verifier: verifier, redirect_uri: callback, resource, ...override }));
  }
  const authorize = req => load("lib/mcp/oauth.ts").authorizeMcpRequest(req);
  const bearer = token => new Request(resource, { method: "POST", headers: { Authorization: "Bearer " + token } });
  return { options, store, auth, account, call, cookie, client, authorizeParams, consent, exchange, authorize, bearer };
}

test("MCP OAuth config is resource-bound and cannot issue machine or write grants", async () => {
  const { options } = await fixture();
  assert.deepEqual(options.scopes, ["radar:read", "offline_access"]);
  assert.deepEqual(options.grantTypes, ["authorization_code", "refresh_token"]);
  assert.deepEqual(options.clientRegistrationDefaultResources, [resource]);
  assert.equal(options.disableJwtPlugin, true); assert.equal(options.storeTokens, "hashed");
  assert.equal(options.refreshTokenReuseInterval, 0);
  assert.equal(await options.clientPrivileges({}), false); assert.equal(await options.resourcePrivileges({}), false);
});
test("MCP real OAuth flow requires sign-in and explicit signed consent", async () => {
  const f = await fixture();
  const response = await f.call("/oauth2/authorize?" + f.authorizeParams);
  const target = response.headers.get("location") ?? (await response.json()).url;
  assert.ok(target.includes("/membros/integracoes/mcp/entrar"), target);
  const code = await f.consent(); const exchanged = await f.exchange(code);
  assert.equal(exchanged.status, 200, await exchanged.clone().text());
  const tokens = await exchanged.json();
  assert.equal(tokens.token_type, "Bearer"); assert.ok(tokens.refresh_token);
  const identity = await f.authorize(f.bearer(tokens.access_token));
  assert.equal(identity.userId, f.account.user.id); assert.equal(identity.clientId, f.client.client_id);
  assert.ok(!JSON.stringify(f.store).includes(tokens.access_token), "stored access token must be hashed");
  assert.ok(!JSON.stringify(f.store).includes(tokens.refresh_token), "stored refresh token must be hashed");
  assert.equal((await f.exchange(code)).status, 400, "authorization code must be single-use");
});
test("MCP rejects an invalid verifier, foreign resource and unregistered redirect", async () => {
  const f = await fixture(); const code = await f.consent();
  assert.equal((await f.exchange(code, { code_verifier: "wrong-".repeat(12) })).status, 400);
  const params = new URLSearchParams(f.authorizeParams); params.set("redirect_uri", "https://evil.example/callback");
  const invalid = await f.call("/oauth2/authorize?" + params, undefined, { Cookie: f.cookie });
  assert.notEqual(invalid.headers.get("location")?.startsWith("https://evil.example"), true);
  const other = new URLSearchParams(f.authorizeParams); other.set("resource", "https://other.example/mcp");
  const response = await f.call("/oauth2/authorize?" + other, undefined, { Cookie: f.cookie });
  const errorTarget = response.headers.get("location") ?? (await response.json()).url;
  assert.ok(response.status >= 400 || new URL(errorTarget, origin).searchParams.has("error"));
});
test("MCP refresh rotates tokens and revocation is observed immediately", async () => {
  const f = await fixture(); const code = await f.consent(); const issued = await f.exchange(code); const tokens = await issued.json();
  const renewed = await f.call("/oauth2/token", new URLSearchParams({ grant_type: "refresh_token", client_id: f.client.client_id,
    refresh_token: tokens.refresh_token, resource }));
  assert.equal(renewed.status, 200, await renewed.clone().text()); const next = await renewed.json();
  assert.notEqual(next.refresh_token, tokens.refresh_token);
  assert.ok(await f.authorize(f.bearer(next.access_token)));
  const revoked = await f.call("/oauth2/revoke", new URLSearchParams({ token: next.access_token, client_id: f.client.client_id, token_type_hint: "access_token" }));
  assert.equal(revoked.status, 200);
  assert.equal(await f.authorize(f.bearer(next.access_token)), null);
});
test("MCP expiry, forged tokens and cookies do not authorize a request", async () => {
  const f = await fixture(); const issued = await f.exchange(await f.consent()); const tokens = await issued.json();
  assert.equal(await f.authorize(f.bearer("forged")), null);
  assert.equal(await f.authorize(new Request(resource, { headers: { Cookie: f.cookie } })), null);
  for (const row of f.store.oauthAccessToken) row.expiresAt = new Date(0);
  assert.equal(await f.authorize(f.bearer(tokens.access_token)), null);
});

test("MCP refuses access after the authorization session has ended", async () => {
  const f = await fixture(); const issued = await f.exchange(await f.consent()); const tokens = await issued.json();
  assert.ok(await f.authorize(f.bearer(tokens.access_token)));
  f.store.session.splice(0);
  assert.equal(await f.authorize(f.bearer(tokens.access_token)), null);
});

test("MCP rejects a token without radar:read even if it has offline access", async () => {
  const f = await fixture(); const params = new URLSearchParams(f.authorizeParams); params.set("scope", "offline_access");
  const issued = await f.exchange(await f.consent(params)); const tokens = await issued.json();
  await assert.rejects(f.authorize(f.bearer(tokens.access_token)), error => error.status === 403 && error.code === "insufficient_scope");
});

test("MCP consent refuses an altered signed redirect or scope", async () => {
  const f = await fixture(); const response = await f.call("/oauth2/authorize?" + f.authorizeParams, undefined, { Cookie: f.cookie });
  const target = response.headers.get("location") ?? (await response.json()).url;
  const signed = new URL(target, origin).searchParams; signed.set("redirect_uri", "https://evil.example/callback");
  const approved = await f.call("/oauth2/consent", { accept: true, oauth_query: signed.toString() }, { Cookie: f.cookie });
  assert.ok(approved.status >= 400); assert.equal(f.store.oauthAccessToken.length, 0);
});
