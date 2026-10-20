import assert from "node:assert/strict";
import { after, test } from "node:test";
import { toNextJsHandler } from "better-auth/next-js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const originalEnv = { ...process.env };
after(() => { process.env = originalEnv; });
const origin = "https://www.apogee.community";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function setup(t, provider = "caddy") {
  process.env.NODE_ENV = "production";
  process.env.APPLICATION_HOSTING_PROVIDER = provider;
  delete process.env.VERCEL;
  const lines = [];
  t.mock.method(console, "warn", (...args) => { lines.push(args); });
  const load = opportunityLoader({
    "better-auth/next-js": { toNextJsHandler },
    // Keep the real route and IP guard; avoid initializing production auth/database.
    "@/lib/members/auth": { getAuth: () => ({ handler: () => Response.redirect(`${origin}/membros/radar/acesso`, 302) }) },
  });
  return { route: load("app/api/auth/[...all]/route.ts"), lines };
}

test("503 confirmation diagnostics correlate the response without disclosing request secrets or personal data", async t => {
  const { route, lines } = setup(t);
  const markers = ["synthetic-token-private", "person@example.test", "synthetic-cookie-private", "synthetic-password-private", "198.51.100.99", "synthetic-request-id-private"];
  const response = await route.GET(new Request(`${origin}/api/auth/verify-email?token=${markers[0]}&email=${encodeURIComponent(markers[1])}&callbackURL=https://example.test/${markers[1]}`, {
    headers: { cookie: markers[2], authorization: `Bearer ${markers[0]}`, "x-forwarded-for": markers[4],
      "user-agent": markers[1], referer: `https://example.test/${markers[0]}`, "x-request-id": markers[5] },
  }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { message: "Autenticação temporariamente indisponível." });
  assert.equal(lines.length, 1, "a rejected request must leave a diagnostic event");
  assert.equal(lines[0].length, 1, "only one serialized allowlisted record is written");
  const record = JSON.parse(lines[0][0]);
  assert.deepEqual(Object.keys(record).sort(), ["alternateIpHeadersPresent", "endpoint", "event", "id", "method", "provider", "reason", "suppressedSinceLastLog", "timestamp", "version"].sort());
  assert.equal(record.event, "member_auth_trust_rejected");
  assert.equal(record.version, 1);
  assert.equal(record.endpoint, "verify_email");
  assert.equal(record.method, "GET");
  assert.equal(record.provider, "caddy");
  assert.equal(record.reason, "missing");
  assert.match(record.id, uuid);
  assert.equal(response.headers.get("x-apogee-error-id"), record.id);
  assert.equal(new Date(record.timestamp).toISOString(), record.timestamp);
  assert.equal(record.alternateIpHeadersPresent, true);
  assert.equal(record.suppressedSinceLastLog, 0);
  for (const marker of markers) assert.ok(!JSON.stringify(lines).includes(marker), "request values must never reach the sink");
});

test("503 diagnostics distinguish missing, empty, ambiguous, scoped and invalid IPs without recording their values", async t => {
  const { route, lines } = setup(t);
  for (const [value, reason] of [[null, "missing"], ["", "empty"], ["invalid-private-value", "invalid"],
    ["198.51.100.2, 203.0.113.3", "ambiguous"], ["fe80::1%private-interface", "zone_id"], ["198.51.100.2:1234", "invalid"]]) {
    const headers = new Headers();
    if (value !== null) headers.set("x-apogee-client-ip", value);
    assert.equal((await route.GET(new Request(`${origin}/api/auth/get-session`, { headers }))).status, 503);
    const event = JSON.parse(lines.at(-1)[0]);
    assert.equal(event.reason, reason);
    assert.equal(event.endpoint, "get_session");
    assert.equal(event.alternateIpHeadersPresent, false);
    if (value) assert.ok(!lines.at(-1)[0].includes(value));
  }
});

test("diagnostic labels cannot inject arbitrary provider, path, query, headers or body into logs", async t => {
  const marker = "synthetic-private-marker";
  const { route, lines } = setup(t, marker);
  const response = await route.POST(new Request(`${origin}/api/auth/${marker}?token=${marker}`, {
    method: "POST", headers: { "content-type": "application/json", "x-apogee-client-ip": marker, "user-agent": marker.repeat(500) },
    body: JSON.stringify({ email: `${marker}@example.test`, password: marker }),
  }));
  assert.equal(response.status, 503);
  const event = JSON.parse(lines[0][0]);
  assert.equal(event.reason, "unsupported_provider");
  assert.equal(event.provider, "unknown");
  assert.equal(event.endpoint, "other");
  assert.equal(event.method, "POST");
  assert.ok(lines[0][0].length < 700, "payload stays bounded independently of input length");
  assert.ok(!lines[0][0].includes(marker));
});

test("unexpected methods and Vercel fallback produce only allowlisted diagnostic labels", async t => {
  const { route, lines } = setup(t, "");
  process.env.VERCEL = "1";
  const response = await route.GET(new Request(`${origin}/api/auth/constructor?token=synthetic-private`, {
    method: "SYNTHETICPRIVATE", headers: { "x-apogee-client-ip": "198.51.100.8" },
  }));
  assert.equal(response.status, 503);
  const event = JSON.parse(lines[0][0]);
  assert.equal(event.provider, "vercel");
  assert.equal(event.reason, "missing");
  assert.equal(event.method, "other");
  assert.equal(event.endpoint, "other");
  assert.equal(event.alternateIpHeadersPresent, true);
  assert.ok(!lines[0][0].includes("SYNTHETICPRIVATE"));
  assert.ok(!lines[0][0].includes("198.51.100.8"));
});

test("valid Caddy and Vercel IPs keep the auth redirect and generate no rejection log", async t => {
  const { route, lines } = setup(t);
  for (const [provider, header, ip] of [["caddy", "x-apogee-client-ip", "198.51.100.2"],
    ["caddy", "x-apogee-client-ip", "2001:db8::2"], ["vercel", "x-vercel-forwarded-for", "198.51.100.3"]]) {
    process.env.APPLICATION_HOSTING_PROVIDER = provider;
    const response = await route.GET(new Request(`${origin}/api/auth/verify-email?token=synthetic`, { headers: { [header]: ip } }));
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), `${origin}/membros/radar/acesso`);
    assert.equal(response.headers.get("x-apogee-error-id"), null);
  }
  assert.equal(lines.length, 0);
});

test("repeated 503s have bounded log volume and report suppression when the window reopens", async t => {
  const { route, lines } = setup(t);
  let now = 1_800_000_000_000;
  t.mock.method(Date, "now", () => now);
  for (let i = 0; i < 25; i++) {
    const response = await route.GET(new Request(`${origin}/api/auth/verify-email?token=synthetic-${i}`));
    assert.equal(response.status, 503);
    if (i < 20) assert.match(response.headers.get("x-apogee-error-id"), uuid);
    else assert.equal(response.headers.get("x-apogee-error-id"), null, "do not advertise an ID without a log record");
  }
  assert.equal(lines.length, 20);
  assert.equal(new Set(lines.map(line => JSON.parse(line[0]).id)).size, 20);
  now += 60_000;
  assert.equal((await route.GET(new Request(`${origin}/api/auth/verify-email?token=synthetic`))).status, 503);
  assert.equal(lines.length, 21);
  assert.equal(JSON.parse(lines.at(-1)[0]).suppressedSinceLastLog, 5);
});

test("a failing log sink cannot expose its error or bypass the 503 guard", async t => {
  const { route } = setup(t);
  t.mock.method(console, "warn", () => { throw new Error("synthetic-private-sink-error"); });
  const response = await route.GET(new Request(`${origin}/api/auth/verify-email?token=synthetic`));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-apogee-error-id"), null);
  assert.deepEqual(await response.json(), { message: "Autenticação temporariamente indisponível." });
});
