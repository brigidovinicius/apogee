import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const origin = "https://www.apogee.community";
const id = "123e4567-e89b-42d3-a456-426614174000";
const valid = (change = {}) => ({ action: "subscribe", opportunityId: id, email: "person@example.test", consent: true, ...change });
function fixture(t, { failKey, backend = () => ({ status: 200, body: { ok: true } }) } = {}) {
  const previousEnv = { ...process.env }; const previousFetch = globalThis.fetch;
  Object.assign(process.env, {
    NODE_ENV: "production", APPLICATION_HOSTING_PROVIDER: "caddy",
    BETTER_AUTH_SECRET: "synthetic-alert-policy-secret-at-least-32-characters",
    RADAR_ACADEMICO_API_URL: "https://synthetic-radar.example", RADAR_ACADEMICO_API_TOKEN: "synthetic-radar-token",
  });
  const counts = new Map(); const budgets = []; const forwarded = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://synthetic-radar.example/api/internal/alerts");
    const payload = JSON.parse(options.body); forwarded.push(payload);
    const result = payload.action === "subscribe" && (!payload.email || !payload.opportunityId || payload.consent !== true)
      ? { status: 400, body: { error: "Solicitação inválida" } } : backend(payload);
    return Response.json(result.body, { status: result.status });
  };
  const load = opportunityLoader({
    "@/lib/members/rate-limit": { consumeRateLimit: async (key, limit, seconds) => {
      budgets.push({ key, limit, seconds });
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (failKey?.(key)) return false;
      return counts.get(key) <= limit;
    } },
  });
  const route = load("app/api/radar/alerts/route.ts");
  t.after(() => { process.env = previousEnv; globalThis.fetch = previousFetch; });
  function request(body, headers = {}) {
    return new Request(`${origin}/api/radar/alerts`, { method: "POST",
      headers: { origin, "content-type": "application/json", "x-apogee-client-ip": "198.51.100.10", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });
  }
  return { counts, budgets, forwarded, post: (body, headers) => route.POST(request(body, headers)) };
}

test("100 malformed subscriptions cannot exhaust the next legitimate subscription", async t => {
  const f = fixture(t);
  for (let i = 0; i < 100; i++) assert.equal((await f.post({ action: "subscribe" })).status, 400);
  assert.equal((await f.post(valid())).status, 200);
  assert.equal(f.counts.get("radar-alerts:subscribe"), 1);
  assert.deepEqual(f.forwarded, [valid()]);
});
test("invalid fields and injected properties fail before any quota or upstream access", async t => {
  const f = fixture(t);
  for (const body of [null, [], {}, { action: "delete" },
    valid({ opportunityId: null }), valid({ opportunityId: 1 }), valid({ opportunityId: "bad" }),
    valid({ opportunityId: "00000000-0000-0000-0000-000000000000" }), valid({ opportunityId: `${id}\n` }),
    valid({ email: null }), valid({ email: 42 }), valid({ email: "bad" }), valid({ email: "a@b.c\nBcc: x@y.test" }),
    valid({ email: "a@example.test,b@example.test" }), valid({ email: `${"a".repeat(250)}@example.test` }),
    valid({ consent: false }), valid({ consent: "true" }), valid({ callbackURL: "https://evil.example" }),
    valid({ recipient: "other@example.test" }), valid({ actor: "admin" }), valid({ token: "a".repeat(64) }),
    { action: "confirm", token: "a".repeat(64), email: "other@example.test" },
    { action: "unsubscribe", token: "bad" }, { action: "confirm", token: `${"a".repeat(64)}\n` },
    { action: "unsubscribe", token: `${"a".repeat(64)}\r\n` }, "{", valid({ email: "x".repeat(5000) })]) {
    assert.equal((await f.post(body)).status, 400);
  }
  assert.equal(f.budgets.length, 0); assert.equal(f.forwarded.length, 0);
});
test("normalization happens before recipient throttling and forwarding", async t => {
  const f = fixture(t);
  assert.equal((await f.post(valid({ email: " Person@Example.Test ", opportunityId: id.toUpperCase() }))).status, 200);
  assert.deepEqual(f.forwarded, [valid()]);
  assert.equal(f.budgets.length, 3);
  assert.deepEqual(f.budgets.map(b => b.limit), [10, 3, 100]);
  assert.ok(f.budgets.every(b => b.seconds === 3600));
  const keys = f.budgets.map(b => b.key).join(" ");
  assert.ok(!keys.includes("person@example.test")); assert.ok(!keys.includes("198.51.100.10"));
});
test("one client cannot exhaust the global budget by rotating recipients or forged headers", async t => {
  const f = fixture(t);
  for (let i = 0; i < 10; i++) assert.equal((await f.post(valid({ email: `person${i}@example.test` }))).status, 200);
  for (let i = 10; i < 110; i++) {
    assert.equal((await f.post(valid({ email: `person${i}@example.test` }), {
      "x-forwarded-for": `203.0.113.${i}`, "x-vercel-forwarded-for": `203.0.113.${i}`, "x-real-ip": `203.0.113.${i}`,
    })).status, 429);
  }
  assert.equal(f.counts.get("radar-alerts:subscribe"), 10); assert.equal(f.forwarded.length, 10);
  assert.equal((await f.post(valid({ email: "another@example.test" }), { "x-apogee-client-ip": "198.51.100.11" })).status, 200);
});
test("recipient aliases and IP changes share one non-enumerating recipient budget", async t => {
  const f = fixture(t);
  for (let i = 0; i < 8; i++) {
    const response = await f.post(valid({ email: i % 2 ? " PERSON@EXAMPLE.TEST " : "person@example.test" }), { "x-apogee-client-ip": `198.51.100.${i + 1}` });
    assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  }
  assert.equal(f.forwarded.length, 3); assert.equal(f.counts.get("radar-alerts:subscribe"), 3);
  assert.equal((await f.post(valid({ email: "other@example.test" }), { "x-apogee-client-ip": "198.51.100.200" })).status, 200);
});
test("global exhaustion cannot block confirmation or cancellation, including without IP or HMAC secret", async t => {
  const f = fixture(t, { failKey: key => key === "radar-alerts:subscribe" });
  assert.equal((await f.post(valid())).status, 429);
  delete process.env.BETTER_AUTH_SECRET;
  for (const action of ["confirm", "unsubscribe"]) {
    assert.equal((await f.post({ action, token: "a".repeat(64) }, { "x-apogee-client-ip": "invalid" })).status, 200);
  }
  assert.deepEqual(f.forwarded.map(p => p.action), ["confirm", "unsubscribe"]);
  assert.ok(f.budgets.every(b => !b.key.includes("a".repeat(64))));
  assert.equal((await f.post({ action: "unsubscribe", token: "invalid" })).status, 400);
});
test("untrusted or invalid IP context fails closed before touching quotas", async t => {
  const f = fixture(t);
  for (const ip of ["", "invalid", "198.51.100.2, 198.51.100.3", "[2001:db8::1]", "198.51.100.2:1234"]) {
    assert.equal((await f.post(valid(), { "x-apogee-client-ip": ip, "x-forwarded-for": "198.51.100.20" })).status, 503);
  }
  process.env.APPLICATION_HOSTING_PROVIDER = "unknown"; delete process.env.VERCEL;
  assert.equal((await f.post(valid())).status, 503);
  assert.equal(f.budgets.length, 0); assert.equal(f.forwarded.length, 0);
});
test("Vercel uses its own trusted header and IPv6 clients remain independent", async t => {
  const f = fixture(t); process.env.APPLICATION_HOSTING_PROVIDER = "vercel";
  for (let i = 0; i < 10; i++) assert.equal((await f.post(valid({ email: `first${i}@example.test` }), { "x-vercel-forwarded-for": "2001:db8::1" })).status, 200);
  assert.equal((await f.post(valid({ email: "blocked@example.test" }), { "x-vercel-forwarded-for": "2001:db8::1", "x-apogee-client-ip": "198.51.100.99" })).status, 429);
  assert.equal((await f.post(valid({ email: "independent@example.test" }), { "x-vercel-forwarded-for": "2001:db8::2" })).status, 200);
});
test("missing or short HMAC configuration fails before persisting identifiable keys", async t => {
  const f = fixture(t);
  for (const secret of ["", "short"]) {
    process.env.BETTER_AUTH_SECRET = secret;
    assert.equal((await f.post(valid())).status, 503);
  }
  assert.equal(f.budgets.length, 0); assert.equal(f.forwarded.length, 0);
});
test("valid distributed subscriptions still share the retained global ceiling", async t => {
  const f = fixture(t);
  for (let i = 0; i < 100; i++) assert.equal((await f.post(valid({ email: `person${i}@example.test` }), { "x-apogee-client-ip": `198.51.100.${i + 1}` })).status, 200);
  assert.equal((await f.post(valid({ email: "excess@example.test" }), { "x-apogee-client-ip": "198.51.100.201" })).status, 429);
  assert.equal(f.forwarded.length, 100);
});
test("a quota-store failure fails closed without forwarding or exposing its error", async t => {
  const f = fixture(t, { failKey: () => { throw new Error("synthetic private database details"); } });
  const response = await f.post(valid()); assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private")); assert.equal(f.forwarded.length, 0);
});
test("cross-site requests cannot reach the quota store or Radar", async t => {
  const f = fixture(t);
  assert.equal((await f.post(valid(), { origin: "https://evil.example" })).status, 403);
  assert.equal((await f.post(valid(), { "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal(f.budgets.length, 0); assert.equal(f.forwarded.length, 0);
});
