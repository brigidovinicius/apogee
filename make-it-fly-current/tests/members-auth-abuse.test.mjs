import assert from "node:assert/strict";
import { after, test } from "node:test";
import { APIError } from "better-auth";
import { getIP } from "@better-auth/core/utils/ip";
import { toNextJsHandler } from "better-auth/next-js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const originalEnv = { ...process.env };
after(() => { process.env = originalEnv; delete globalThis.__apogeeMembersAuth; });
process.env.NODE_ENV = "production";
process.env.BETTER_AUTH_SECRET = "synthetic-security-secret-at-least-32-characters";

function optionsFor(provider) {
  process.env.APPLICATION_HOSTING_PROVIDER = provider;
  delete process.env.VERCEL;
  delete globalThis.__apogeeMembersAuth;
  let options;
  const counts = new Map();
  const load = opportunityLoader({
    "better-auth": { APIError, betterAuth: value => { options = value; return {}; } },
    "better-auth/api": { createAuthMiddleware: callback => callback },
    "better-auth/adapters/drizzle": { drizzleAdapter: () => ({}) },
    "better-auth/next-js": { nextCookies: () => ({}) }, "better-auth/plugins": { username: () => ({}) },
    "./db": { getDb: () => ({}) }, "./schema": {},
    "./mail": { applicationOrigin: () => "https://www.apogee.community" },
    // Apenas o I/O de banco é substituído; a política de abuso vem do auth real.
    "./rate-limit": { consumeRateLimit: async (key, max) => {
      counts.set(key, (counts.get(key) ?? 0) + 1); return counts.get(key) <= max;
    } },
  });
  load("lib/members/auth.ts").getAuth();
  return { options, counts };
}

test("Caddy login cannot change its Better Auth rate-limit identity through provider headers", () => {
  const { options } = optionsFor("caddy");
  for (const forged of ["203.0.113.1", "203.0.113.2", "203.0.113.3"]) {
    const headers = new Headers({ "x-apogee-client-ip": "198.51.100.200", "x-vercel-forwarded-for": forged,
      "x-forwarded-for": forged, "x-real-ip": forged, "cf-connecting-ip": forged });
    assert.equal(getIP(headers, options), "198.51.100.200");
  }
});

test("Vercel accepts only its own platform header and never falls back to X-Forwarded-For", () => {
  const { options } = optionsFor("vercel");
  assert.equal(getIP(new Headers({ "x-vercel-forwarded-for": "198.51.100.201", "x-forwarded-for": "203.0.113.1" }), options), "198.51.100.201");
  assert.equal(getIP(new Headers({ "x-forwarded-for": "203.0.113.1" }), options), null);
});

test("direct GET/POST auth fails closed when trusted client IP is missing, malformed or ambiguous", async () => {
  process.env.APPLICATION_HOSTING_PROVIDER = "caddy";
  let handled = 0;
  const load = opportunityLoader({
    "better-auth/next-js": { toNextJsHandler },
    "@/lib/members/auth": { getAuth: () => ({ handler: () => { handled++; return new Response("OK"); } }) },
  });
  const route = load("app/api/auth/[...all]/route.ts");
  for (const method of ["GET", "POST"]) {
    for (const ip of [null, "invalid", "198.51.100.2, 203.0.113.1", "198.51.100.2:1234"]) {
      const headers = new Headers({ "x-vercel-forwarded-for": "203.0.113.1", "x-forwarded-for": "203.0.113.1" });
      if (ip) headers.set("x-apogee-client-ip", ip);
      const response = await route[method](new Request("https://www.apogee.community/api/auth/sign-in/email", { method, headers }));
      assert.equal(response.status, 503);
    }
  }
  assert.equal(handled, 0, "invalid trust context must fail before auth/database initialization");
  for (const ip of ["198.51.100.2", "2001:db8::2"]) {
    assert.equal((await route.POST(new Request("https://www.apogee.community/api/auth/sign-in/email", {
      method: "POST", headers: { "x-apogee-client-ip": ip },
    }))).status, 200);
  }
  process.env.APPLICATION_HOSTING_PROVIDER = "unknown";
  assert.equal((await route.POST(new Request("https://www.apogee.community/api/auth/sign-in/email", {
    method: "POST", headers: { "x-apogee-client-ip": "198.51.100.2" },
  }))).status, 503);
});

test("direct logins share an account limit across IP changes and normalized identifiers", async () => {
  const { options, counts } = optionsFor("caddy");
  assert.equal(typeof options.hooks?.before, "function", "account policy must be installed in Better Auth");
  for (const [path, field, identifier] of [["/sign-in/email", "email", "victim@example.test"], ["/sign-in/username", "username", "victim"]]) {
    for (let i = 0; i < 8; i++) await options.hooks.before({ path, headers: new Headers({ "x-apogee-client-ip": `198.51.100.${i + 1}` }),
      body: { [field]: i % 2 ? identifier.toUpperCase() : identifier, password: "synthetic-password" } });
    await assert.rejects(options.hooks.before({ path, headers: new Headers({ "x-apogee-client-ip": "198.51.100.100" }),
      body: { [field]: identifier, password: "synthetic-password" } }), error => error.statusCode === 429);
  }
  assert.equal(counts.size, 2);
  for (const key of counts.keys()) assert.ok(!key.includes("victim"), "account rate-limit keys must not persist identifiers in clear text");
});

test("malformed identifiers cannot skip the shared sign-in policy", async () => {
  const { options, counts } = optionsFor("caddy");
  for (const value of [undefined, null, 123, ["victim@example.test"], "", "   ", "x".repeat(321)]) {
    await assert.rejects(options.hooks.before({ path: "/sign-in/email",
      headers: new Headers({ "x-apogee-client-ip": "198.51.100.1" }), body: { email: value },
    }), error => error.statusCode === 400);
  }
  assert.equal(counts.size, 0);
});
