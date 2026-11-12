import assert from "node:assert/strict";
import test from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { handleCommunityContact } = opportunityLoader()("lib/community/contacts.ts");
const origin = "https://www.apogee.community";
const valid = { campaign: "codex", name: "  Pessoa Sintética  ", email: " TEST@example.test ", goal: "Pesquisar melhor", consent: true, website: "" };
function request(payload = valid, headers = {}) {
  return new Request(`${origin}/api/comunidade/contatos`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: typeof payload === "string" ? payload : JSON.stringify(payload) });
}
function setup(overrides = {}) {
  const saved = [], limits = [];
  return { saved, limits, deps: { allowedOrigins: [origin], secret: "s".repeat(32), clientIp: () => "127.0.0.1", consumeLimit: async (...args) => { limits.push(args); return true; }, save: async contact => { saved.push(contact); }, ...overrides } };
}

test("event request normalizes fields and acknowledges only after persistence", async () => {
  const { deps, saved, limits } = setup();
  const response = await handleCommunityContact(request(), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(saved, [{ campaign: "codex", name: "Pessoa Sintética", email: "test@example.test", goal: "Pesquisar melhor" }]);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(limits.length, 3);
  assert.ok(limits.every(([key]) => !key.includes("test@example") && !key.includes("127.0.0.1")));
});

test("cross-origin, invalid body, missing consent and unsupported campaigns never persist", async () => {
  const inputs = [
    [request(valid, { origin: "https://other.example" }), 403],
    [request(valid, { "sec-fetch-site": "cross-site" }), 403],
    [request(valid, { "content-type": "text/plain" }), 415],
    [request("{invalid"), 400], [request("x".repeat(8193)), 413],
    ...[{ consent: false }, { consent: undefined }, { campaign: "community" }, { name: "A" }, { name: "A\nB" }, { email: "invalid" }, { goal: "x".repeat(601) }, { role: "admin" }].map(patch => [request({ ...valid, ...patch }), 400]),
  ];
  for (const [input, status] of inputs) {
    const { deps, saved } = setup();
    assert.equal((await handleCommunityContact(input, deps)).status, status);
    assert.equal(saved.length, 0);
  }
});

test("optional answer may be omitted; honeypot creates no contact", async () => {
  const accepted = setup();
  assert.equal((await handleCommunityContact(request({ ...valid, goal: undefined }), accepted.deps)).status, 200);
  assert.equal(accepted.saved[0].goal, "");
  const bot = setup();
  assert.equal((await handleCommunityContact(request({ ...valid, website: "spam.example" }), bot.deps)).status, 200);
  assert.equal(bot.saved.length, 0);
  assert.equal(bot.limits.length, 0);
});

test("each persistent rate limit and database failure prevents false success", async () => {
  for (const blockAt of [1, 2, 3]) {
    let calls = 0;
    const { deps, saved } = setup({ consumeLimit: async () => ++calls !== blockAt });
    assert.equal((await handleCommunityContact(request(), deps)).status, 429);
    assert.equal(saved.length, 0);
  }
  for (const overrides of [{ secret: "" }, { clientIp: () => null }, { save: async () => { throw new Error("private-database-url"); } }]) {
    const response = await handleCommunityContact(request(), setup(overrides).deps);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private-database-url"));
  }
});

test("route preserves original contact on repetition and records purpose-specific consent", async () => {
  const rows = new Map();
  const load = opportunityLoader({
    "@/lib/members/db": { getSql: () => async (sql, ...values) => {
      assert.match(sql.join("?"), /on conflict \(campaign, email\) do nothing/);
      const [campaign, name, email, goal, version, consent] = values;
      assert.equal(version, "2026-11-12-v1");
      assert.match(consent, /Codex Community/);
      const key = `${campaign}:${email}`;
      if (!rows.has(key)) rows.set(key, { name, goal });
    } },
    "@/lib/members/client-ip": { memberClientIp: () => "127.0.0.1" },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => true },
  });
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "s".repeat(32);
  try {
    const { POST } = load("app/api/comunidade/contatos/route.ts");
    assert.equal((await POST(request())).status, 200);
    assert.equal((await POST(request({ ...valid, name: "Outra pessoa" }))).status, 200);
    assert.equal(rows.size, 1);
    assert.equal(rows.get("codex:test@example.test").name, "Pessoa Sintética");
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});

test("administrative list checks authorization before touching contacts", async () => {
  let queries = 0;
  const load = opportunityLoader({
    "./access": { requireAdmin: async () => { throw new Error("ACCESS_DENIED"); } },
    "@/lib/members/db": { getSql: () => { queries++; throw new Error("must not read"); } },
  });
  await assert.rejects(load("lib/admin/community-contacts.ts").listCommunityContacts("1"), /ACCESS_DENIED/);
  assert.equal(queries, 0);
});

test("Make It Fly redirects are temporary so its archived implementation can be restored", async () => {
  const config = opportunityLoader()("next.config.ts").default;
  const redirects = await config.redirects();
  assert.deepEqual(redirects.find(row => row.source === "/makeitfly/:path*"), { source: "/makeitfly/:path*", destination: "/comunidade", permanent: false });
});
