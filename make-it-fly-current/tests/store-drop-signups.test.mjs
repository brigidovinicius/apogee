import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { handleDropSignup, DROP_CONSENT_TEXT, DROP_CONSENT_VERSION } = opportunityLoader()("lib/store/drop-signups.ts");
const origin = "https://www.apogee.community";
const valid = { name: "  Maria Silva  ", phone: "+55 (11) 99999-1234", email: " MARIA@example.com ", consent: true, website: "" };
function request(payload = valid, headers = {}) {
  return new Request(`${origin}/api/loja/novidades`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
}
function setup(overrides = {}) {
  const saved = [], limits = [];
  return { saved, limits, deps: { allowedOrigins: [origin], secret: "s".repeat(32), clientIp: () => "127.0.0.1", consumeLimit: async (...args) => { limits.push(args); return true; }, save: async data => { saved.push(data); }, ...overrides } };
}

test("valid signup saves only normalized contact fields before acknowledging success", async () => {
  const { deps, saved, limits } = setup();
  const result = await handleDropSignup(request(), deps);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.deepEqual(saved, [{ name: "Maria Silva", phone: "+5511999991234", email: "maria@example.com" }]);
  assert.equal(limits.length, 3);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.ok(limits.every(([key]) => !key.includes("127.0.0.1") && !key.includes("maria")));
});

test("origin, content type, invalid JSON, extra fields and oversized bodies are rejected without saving", async () => {
  const cases = [
    [request(valid, { origin: "https://other.example" }), 403],
    [request(valid, { "sec-fetch-site": "cross-site" }), 403],
    [request(valid, { "content-type": "text/plain" }), 415],
    [request("{invalid"), 400],
    [request({ ...valid, role: "admin" }), 400],
    [request("x".repeat(4097)), 413],
    [request(valid, { "content-length": "4097" }), 413],
  ];
  for (const [input, status] of cases) {
    const { deps, saved } = setup();
    assert.equal((await handleDropSignup(input, deps)).status, status);
    assert.equal(saved.length, 0);
  }
});

test("all three fields and explicit consent are required on the server", async () => {
  for (const patch of [{ name: " " }, { name: "A" }, { name: "A\nB" }, { name: "x".repeat(121) }, { phone: "123" }, { phone: "+5511999991234extra" }, { phone: "(11) 99999-1234 ext 2" }, { email: "invalid" }, { consent: false }, { consent: "true" }, { consent: undefined }]) {
    const { deps, saved } = setup();
    assert.equal((await handleDropSignup(request({ ...valid, ...patch }), deps)).status, 400, JSON.stringify(patch));
    assert.equal(saved.length, 0);
  }
});

test("honeypot submissions do not persist or spend a rate-limit budget", async () => {
  const { deps, saved, limits } = setup();
  assert.equal((await handleDropSignup(request({ ...valid, website: "spam.example" }), deps)).status, 200);
  assert.equal(saved.length, 0);
  assert.equal(limits.length, 0);
});

test("persistent IP, recipient and global limits each stop persistence", async () => {
  for (const blockAt of [1, 2, 3]) {
    let calls = 0;
    const { deps, saved } = setup({ consumeLimit: async () => ++calls !== blockAt });
    assert.equal((await handleDropSignup(request(), deps)).status, 429);
    assert.equal(calls, blockAt);
    assert.equal(saved.length, 0);
  }
});

test("unavailable configuration, rate database or contact database never acknowledges a saved signup", async () => {
  for (const overrides of [{ secret: "" }, { clientIp: () => null }, { consumeLimit: async () => { throw new Error("private db connection"); } }, { save: async () => { throw new Error("private db connection"); } }]) {
    const { deps } = setup(overrides);
    const response = await handleDropSignup(request(), deps);
    assert.equal(response.status, 503);
    const result = await response.json();
    assert.notEqual(result.ok, true);
    assert.ok(!JSON.stringify(result).includes("private db"));
  }
});

test("route persists consent evidence and duplicate email does not overwrite original details", async () => {
  const rows = new Map();
  const load = opportunityLoader({
    "@/lib/members/db": { getSql: () => async (sql, ...values) => {
      assert.match(sql.join("?"), /insert into store_drop_signup/);
      assert.match(sql.join("?"), /on conflict \(email\) do nothing/);
      const [name, phone, email, consentVersion, consentText] = values;
      assert.equal(consentVersion, DROP_CONSENT_VERSION);
      assert.equal(consentText, DROP_CONSENT_TEXT);
      if (!rows.has(email)) rows.set(email, { name, phone, email });
    } },
    "@/lib/members/client-ip": { memberClientIp: () => "127.0.0.1" },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => true },
  });
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "s".repeat(32);
  try {
    const { POST } = load("app/api/loja/novidades/route.ts");
    assert.equal((await POST(request())).status, 200);
    assert.equal((await POST(request({ ...valid, name: "Different Person", phone: "11911112222" }))).status, 200);
    assert.equal(rows.size, 1);
    assert.equal(rows.get("maria@example.com").name, "Maria Silva");
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});
