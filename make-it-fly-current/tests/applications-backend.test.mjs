import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../lib/applications.ts", import.meta.url), "utf8");
// Next resolves this build-time boundary; plain Node tests need no package shim.
const { outputText } = ts.transpileModule(source.replace('import "server-only";', ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const api = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const NOW = Date.parse("2026-09-12T16:00:00Z");
const ORIGIN = "https://makeitfly.vercel.app";
const env = {
  NODE_ENV: "production",
  APPLICATION_ORIGIN: ORIGIN,
  APPLICATION_SIGNING_SECRET: "test-secret-not-for-production-1234567890",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_testonly012345678901234567890",
};

function payload(overrides = {}) {
  return { name: "TESTE INTERNO", email: "test@example.com", phone: "+1 (202) 555-0101", age: 28, profession: "Design de produto", hasIdea: true, ideaDescription: "", hasLaptop: true, usesPaidAI: true, journeyId: randomUUID(), website: "", idempotencyKey: randomUUID(), ...overrides };
}

function request(body, headers = {}) {
  return new Request(`${ORIGIN}/api/applications`, {
    method: "POST", headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function fakeDatabase() {
  const rows = new Map();
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    assert.ok(url.startsWith(`${env.SUPABASE_URL}/rest/v1/applications?`));
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    const search = new URL(url).searchParams;
    if (options.method === "POST") {
      const body = JSON.parse(options.body);
      assert.equal("eligible" in body, false, "database derives eligibility");
      assert.equal("purchased_at" in body, false);
      if (rows.has(body.idempotency_key)) return Response.json({ code: "23505" }, { status: 409 });
      const row = { ...body, id: randomUUID(), created_at: "2026-09-12T16:00:00Z", eligible: body.age >= 18 && body.age <= 35 && body.has_idea && body.has_laptop && body.uses_paid_ai, checkout_started_at: null };
      rows.set(body.idempotency_key, row);
      return Response.json([row], { status: 201 });
    }
    const found = [...rows.values()].filter((row) => {
      for (const field of ["id", "idempotency_key", "eligible", "status"]) {
        if (search.has(field) && String(row[field]) !== search.get(field).slice(3)) return false;
      }
      return true;
    });
    if (options.method === "PATCH") for (const row of found) Object.assign(row, JSON.parse(options.body));
    return Response.json(found);
  };
  return { rows, calls, fetcher };
}

function options(database, changes = {}) {
  return { env, now: () => NOW, rateLimiter: () => true, fetcher: database.fetcher, ...changes };
}

for (const hasIdea of [false, true]) {
  for (const hasLaptop of [false, true]) {
    for (const usesPaidAI of [false, true]) {
    test(`persists idea ${hasIdea}, laptop ${hasLaptop}, AI ${usesPaidAI}; score stays private`, async () => {
      const db = fakeDatabase();
      const submitted = payload({ hasIdea, hasLaptop, usesPaidAI, ideaDescription: "" });
      const response = await api.handleApplicationPost(request(submitted), options(db));
      assert.equal(response.status, 201);
      assert.equal(db.rows.size, 1);
      const result = await response.json();
      const eligible = hasIdea && hasLaptop && usesPaidAI;
      assert.deepEqual(result, { received: true });
      const record = [...db.rows.values()][0];
      assert.equal(record.status, eligible ? "APPROVED" : "NOT_ELIGIBLE");
      assert.equal(record.eligible, eligible);
      assert.equal(record.phone, "12025550101");
      assert.equal(record.age, 28);
      assert.equal(record.profession, "Design de produto");
      assert.equal(record.has_laptop, hasLaptop);
      assert.equal(record.journey_id, submitted.journeyId);
      assert.equal(record.checkout_started_at, null);
      assert.equal("purchased_at" in record, false);
    });
    }
  }
}

test("age eligibility is inclusive from 18 through 35 while every valid age is stored", async () => {
  for (const [age, eligible] of [[17, false], [18, true], [35, true], [36, false]]) {
    const db = fakeDatabase();
    const response = await api.handleApplicationPost(request(payload({ age })), options(db));
    assert.equal(response.status, 201);
    const record = [...db.rows.values()][0];
    assert.equal(record.age, age);
    assert.equal(record.eligible, eligible);
    assert.equal(record.status, eligible ? "APPROVED" : "NOT_ELIGIBLE");
  }
});

test("description does not affect eligibility; hidden description is discarded for No", () => {
  assert.equal(api.validateApplication(payload({ hasIdea: false, ideaDescription: "Hidden stale description" })).ideaDescription, "");
  assert.equal(api.validateApplication(payload()).ideaDescription, "");
});

test("strict booleans and untrusted eligibility/status are rejected", () => {
  for (const field of ["hasIdea", "hasLaptop", "usesPaidAI"]) {
    for (const value of ["true", "false", 1, 0, null, undefined, [], {}]) {
      assert.throws(() => api.validateApplication(payload({ [field]: value })), (error) => error.status === 400 && field in error.fieldErrors);
    }
  }
  for (const field of ["eligible", "status", "checkoutUrl", "purchased_at"]) assert.throws(() => api.validateApplication(payload({ [field]: true })), { status: 400 });
  assert.throws(() => api.validateApplication(payload({ journeyId: "not-a-uuid" })), { status: 400 });
});

test("validates profile, contact, description, UTM and UUID bounds", () => {
  for (const invalid of [
    { name: "a" }, { name: "a".repeat(121) }, { name: "João\u0000" },
    { email: "bad" }, { email: "test@localhost" }, { email: "a @example.com" }, { email: `${"a".repeat(250)}@example.com` },
    { phone: "123456789" }, { phone: "1".repeat(16) }, { phone: "abc12025550101" }, { phone: "++12025550101" },
    { age: "28" }, { age: 0 }, { age: 12.5 }, { age: 121 },
    { profession: "x" }, { profession: "x".repeat(161) }, { profession: 123 },
    { ideaDescription: "x".repeat(2001) }, { utmSource: "x".repeat(201) }, { idempotencyKey: "not-a-uuid" },
    { referrer: "javascript:alert(1)" }, { referrer: "https://secret@example.com/path" },
  ]) assert.throws(() => api.validateApplication(payload(invalid)), { status: 400 });
  const valid = api.validateApplication(payload({ name: "  João   Silva  ", email: "Test@Example.com", phone: "(11) 99999-9999", profession: "  Produto   e tecnologia ", referrer: "https://example.com/path?token=secret#private" }));
  assert.equal(valid.name, "João Silva");
  assert.equal(valid.email, "test@example.com");
  assert.equal(valid.phone, "11999999999");
  assert.equal(valid.profession, "Produto e tecnologia");
  assert.equal(valid.referrer, "https://example.com");
});

test("same normalized application and UUID retry does not duplicate; payload mismatch leaks no PII", async () => {
  const db = fakeDatabase();
  const body = payload();
  const first = await api.handleApplicationPost(request(body), options(db));
  const second = await api.handleApplicationPost(request({ ...body, email: "TEST@example.com" }), options(db));
  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(db.rows.size, 1);
  const mismatch = await api.handleApplicationPost(request({ ...body, email: "other@example.com" }), options(db));
  assert.equal(mismatch.status, 409);
  const error = await mismatch.text();
  assert.equal(error.includes(body.email), false);
  assert.equal(error.includes(body.name), false);
  assert.equal(error.includes("checkoutUrl"), false);
  assert.equal(db.rows.size, 1);
});

test("parallel retries are resolved by the database unique key", async () => {
  const db = fakeDatabase();
  const body = payload();
  const responses = await Promise.all([1, 2, 3].map(() => api.handleApplicationPost(request(body), options(db))));
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 200, 201]);
  assert.equal(db.rows.size, 1);
});

test("missing server configuration fails closed before database access", async () => {
  const db = fakeDatabase();
  for (const field of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "APPLICATION_SIGNING_SECRET", "APPLICATION_ORIGIN"]) {
    const response = await api.handleApplicationPost(request(payload()), options(db, { env: { ...env, [field]: "" } }));
    assert.equal(response.status, 503, field);
    assert.equal((await response.text()).includes("checkoutUrl"), false);
  }
  assert.throws(() => api.readApplicationConfig({ ...env, SUPABASE_SECRET_KEY: "sb_publishable_publickey" }), { status: 503 });
  assert.equal(db.calls.length, 0);
});

test("spreadsheet webhook is optional, restricted to Apps Script and best effort", async () => {
  for (const url of ["http://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz/exec", "https://evil.example/macros/s/abcdefghijklmnopqrstuvwxyz/exec", "https://script.google.com/macros/s/short/exec", "https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz/exec?token=private"]) {
    assert.throws(() => api.readApplicationConfig({ ...env, GOOGLE_SHEETS_WEBHOOK_URL: url }), { status: 503 });
  }

  const db = fakeDatabase();
  const webhookUrl = "https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz123456/exec";
  const sheetCalls = [];
  const fetcher = async (url, init) => {
    if (url === webhookUrl) {
      sheetCalls.push({ url, init });
      return Response.json({ received: true });
    }
    return db.fetcher(url, init);
  };
  const response = await api.handleApplicationPost(request(payload()), options(db, {
    env: { ...env, GOOGLE_SHEETS_WEBHOOK_URL: webhookUrl }, fetcher,
  }));
  assert.equal(response.status, 201);
  assert.equal(sheetCalls.length, 1);
  const pushed = JSON.parse(sheetCalls[0].init.body);
  assert.equal(pushed.age, 28);
  assert.equal(pushed.profession, "Design de produto");
  assert.equal(pushed.hasLaptop, true);
  assert.equal(pushed.eligible, true);
  assert.equal(sheetCalls[0].init.redirect, "follow");

  const unavailable = fakeDatabase();
  const outage = await api.handleApplicationPost(request(payload()), options(unavailable, {
    env: { ...env, GOOGLE_SHEETS_WEBHOOK_URL: webhookUrl },
    fetcher: async (url, init) => url === webhookUrl ? Promise.reject(new Error("sheets unavailable")) : unavailable.fetcher(url, init),
  }));
  assert.equal(outage.status, 201);
  assert.equal(unavailable.rows.size, 1);
});

test("database outage, empty or invalid confirmation never produce approval", async () => {
  for (const fetcher of [
    async () => { throw new Error("network error with secret details"); },
    async () => Response.json({ message: "private database error" }, { status: 500 }),
    async () => Response.json([], { status: 201 }),
    async () => new Response("bad json", { status: 201 }),
    async () => Response.json([{ id: randomUUID(), eligible: true, status: "APPROVED", payload_hash: "bad" }], { status: 201 }),
  ]) {
    const response = await api.handleApplicationPost(request(payload()), options({ fetcher }));
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.equal(body.includes("checkoutUrl"), false);
    assert.equal(body.includes("secret details"), false);
    assert.equal(body.includes("private database"), false);
  }
});

test("origin, content type, request size, malformed JSON and honeypot reject without persistence", async () => {
  const db = fakeDatabase();
  const cases = [
    [request(payload(), { origin: "https://evil.example" }), 403],
    [request(payload(), { origin: "null" }), 403],
    [request(payload(), { "sec-fetch-site": "cross-site" }), 403],
    [request(payload(), { "content-type": "text/plain" }), 415],
    [request(payload(), { "content-length": "17000" }), 413],
    [request("x".repeat(17000)), 413],
    [request("{broken"), 400],
    [request(payload({ website: "https://spam.example" })), 400],
  ];
  for (const [req, expectedStatus] of cases) assert.equal((await api.handleApplicationPost(req, options(db))).status, expectedStatus);
  assert.equal(db.rows.size, 0);
  assert.equal(db.calls.length, 0);
});

test("rate limiter has explicit bounds, expiration and 429 with retry hint", async () => {
  const limit = api.createApplicationRateLimiter(2, 1000);
  assert.equal(limit("one", 0), true);
  assert.equal(limit("one", 1), true);
  assert.equal(limit("one", 2), false);
  assert.equal(limit("two", 2), true);
  assert.equal(limit("one", 1000), true);
  const db = fakeDatabase();
  const response = await api.handleApplicationPost(request(payload()), options(db, { rateLimiter: () => false }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "600");
  assert.equal(db.calls.length, 0);
});

test("new secret keys never become Bearer JWTs", async () => {
  const db = fakeDatabase();
  await api.handleApplicationPost(request(payload()), options(db));
  assert.equal(db.calls[0].options.headers.apikey, env.SUPABASE_SECRET_KEY);
  assert.equal(db.calls[0].options.headers.Authorization, undefined);
});

test("the legacy checkout endpoint is disabled and contains no Sympla destination", async () => {
  const route = await readFile(new URL("../app/api/checkout/route.ts", import.meta.url), "utf8");
  assert.match(route, /status: 410/);
  assert.match(route, /acesso automático ao ingresso foi encerrado/);
  assert.doesNotMatch(route, /SYMPLA|Location|handleCheckoutGet/);
});

test("legacy service_role is accepted server-side; anon JWT is rejected", () => {
  const key = (role) => `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.test-only-signature`;
  assert.equal(api.readApplicationConfig({ ...env, SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: key("service_role") }).databaseKey, key("service_role"));
  assert.throws(() => api.readApplicationConfig({ ...env, SUPABASE_SECRET_KEY: "", SUPABASE_SERVICE_ROLE_KEY: key("anon") }), { status: 503 });
});

test("local origin only permits HTTP/HTTPS; production never permits HTTP", () => {
  assert.equal(api.readApplicationConfig({ ...env, NODE_ENV: "development", APPLICATION_ORIGIN: "http://localhost:3017" }).origin, "http://localhost:3017");
  for (const origin of ["ftp://localhost:3017", "ws://localhost:3017", "file://localhost/"]) assert.throws(() => api.readApplicationConfig({ ...env, NODE_ENV: "development", APPLICATION_ORIGIN: origin }), { status: 503 });
  assert.throws(() => api.readApplicationConfig({ ...env, APPLICATION_ORIGIN: "http://localhost:3017" }), { status: 503 });
});

test("foreign platform and generic forwarding headers cannot rotate rate buckets", async () => {
  for (const hostingProvider of ["netlify", "unknown"]) {
    const db = fakeDatabase();
    const keys = [];
    for (const ip of ["1.2.3.4", "5.6.7.8"]) {
      const response = await api.handleApplicationPost(request(payload(), { "x-vercel-forwarded-for": ip, "x-forwarded-for": ip, "x-nf-client-connection-ip": "192.0.2.1" }), options(db, {
        env: { ...env, APPLICATION_HOSTING_PROVIDER: hostingProvider }, rateLimiter: (key) => { keys.push(key); return true; },
      }));
      assert.equal(response.status, 201);
    }
    assert.equal(keys[0], keys[1]);
  }
});

test("schema grants only server access and enforces eligibility/idempotency without public policies", async () => {
  const sql = await readFile(new URL("../supabase/migrations/202609120001_applications.sql", import.meta.url), "utf8");
  const criteriaSql = await readFile(new URL("../supabase/migrations/202609130002_application_profile_criteria.sql", import.meta.url), "utf8");
  assert.match(sql, /eligible boolean generated always as \(has_idea and uses_paid_ai\) stored/);
  assert.match(sql, /idempotency_key uuid not null unique/);
  assert.match(sql, /alter table public\.applications enable row level security/i);
  assert.match(sql, /revoke all on public\.applications from public, anon, authenticated/i);
  assert.match(sql, /grant select, insert, update on public\.applications to service_role/i);
  assert.doesNotMatch(sql, /create policy/i);
  assert.match(criteriaSql, /add column age smallint check \(age between 1 and 120\)/);
  assert.match(criteriaSql, /add column profession text check \(char_length\(profession\) between 2 and 160\)/);
  assert.match(criteriaSql, /add column has_laptop boolean/);
  assert.match(criteriaSql, /add column journey_id uuid/);
  assert.match(criteriaSql, /create index applications_journey_id_idx/);
  assert.match(criteriaSql, /coalesce\(age between 18 and 35, false\)[\s\S]*has_idea[\s\S]*coalesce\(has_laptop, false\)[\s\S]*uses_paid_ai/);
  assert.match(criteriaSql, /profession[\s\S]*Informational only; it does not affect eligibility/);
  assert.match(criteriaSql, /create table public\.journey_events/);
  assert.match(criteriaSql, /alter table public\.journey_events enable row level security/i);
  assert.match(criteriaSql, /revoke all on public\.journey_events from public, anon, authenticated/i);
  assert.match(criteriaSql, /grant select, insert on public\.journey_events to service_role/i);
  assert.match(source, /import "server-only"/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_/);
});
