import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load() {
  const src = readFileSync(new URL("../lib/pre-registration.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  new Function("require", "exports", outputText)(require, exports);
  return exports;
}
function request(body = {}, headers = {}) {
  return new Request("https://landing.example/api/pre-inscricao", { method: "POST", headers: { origin: "https://landing.example", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
test("origin ignores spoofed Host and forwarded headers and fails closed without configuration", () => {
  const { validOrigin, clientIp } = load();
  const old = { ...process.env };
  try {
    delete process.env.PRE_REGISTRATION_ORIGIN;
    assert.equal(validOrigin(request()), false);
    process.env.PRE_REGISTRATION_ORIGIN = "https://landing.example";
    assert.equal(validOrigin(request()), true);
    assert.equal(validOrigin(request({}, { origin: "https://evil.example", host: "evil.example" })), false);
    delete process.env.TRUST_PROXY_CLIENT_IP;
    assert.equal(clientIp(new Headers({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" })), null);
    process.env.TRUST_PROXY_CLIENT_IP = "true";
    assert.equal(clientIp(new Headers({ "x-real-ip": "1.1.1.1, 8.8.8.8" })), null);
    assert.equal(clientIp(new Headers({ "x-real-ip": "8.8.8.8" })), "8.8.8.8");
  } finally { process.env = old; }
});
test("body caps count streamed bytes and cancel slow/oversized bodies", async () => {
  const { readRegistrationBody } = load();
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(2049)); }, cancel() { cancelled = true; } });
  await assert.rejects(readRegistrationBody(new Request("https://test.example", { method: "POST", body: stream, duplex: "half" })));
  assert.equal(cancelled, true);
  await assert.rejects(readRegistrationBody(new Request("https://test.example", { method: "POST", body: new ReadableStream({}), duplex: "half" }), 10));
});
test("rejects arbitrary keys, prototype keys and oversized fields", () => {
  const { registrationFields } = load();
  assert.throws(() => registrationFields({ role: "admin" }));
  assert.throws(() => registrationFields(JSON.parse('{"__proto__":"bad"}')));
  assert.throws(() => registrationFields({ page: "x".repeat(2049) }));
  assert.deepEqual(registrationFields({ event: "participacao_click", source: "landing_page", page: "https://example.com" }), { page: "https://example.com" });
});
test("upstream errors stay generic; spoofed IP cannot reset the rate limit", async () => {
  const { handlePreRegistration } = load();
  const old = { ...process.env };
  const oldFetch = globalThis.fetch;
  let calls = 0;
  try {
    process.env.PRE_REGISTRATION_ORIGIN = "https://landing.example";
    process.env.SUPABASE_WEBHOOK_URL = "https://webhook.example/secret-path";
    delete process.env.TRUST_PROXY_CLIENT_IP;
    globalThis.fetch = async (_url, init) => {
      calls++;
      assert.equal(init.redirect, "error");
      assert.ok(init.signal);
      assert.equal(JSON.parse(init.body).ip, null);
      return new Response("database password secret", { status: 500 });
    };
    for (let i = 0; i < 5; i++) {
      const response = await handlePreRegistration(request({}, { "x-forwarded-for": `8.8.8.${i}` }));
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /database|password|secret/);
    }
    const limited = await handlePreRegistration(request());
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal(calls, 5);
  } finally { globalThis.fetch = oldFetch; process.env = old; }
});
