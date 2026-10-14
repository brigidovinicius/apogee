import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/api/radar/alerts/route.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const require = createRequire(import.meta.url);

test("subscription exhaustion does not block confirmation or cancellation", async () => {
  const budgets = [], forwarded = [], exports = {};
  const deps = {
    "@/lib/opportunities/radar-alerts-client": {
      readAlertBody: request => request.json(),
      radarAlertRequest: async payload => { forwarded.push(payload); return { status: 200, body: { ok: true } }; },
    },
    "@/lib/members/rate-limit": {
      consumeRateLimit: async (key, limit) => { budgets.push({ key, limit }); return key !== "radar-alerts:subscribe"; },
    },
  };
  new Function("require", "exports", code)(id => deps[id] ?? require(id), exports);
  const request = body => new Request("https://www.apogee.community/api/radar/alerts", {
    method: "POST", headers: { origin: "https://www.apogee.community", "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await exports.POST(request({ action: "subscribe", email: "a@example.test" }))).status, 429);
  for (const action of ["confirm", "unsubscribe"]) {
    assert.equal((await exports.POST(request({ action, token: "a".repeat(64) }))).status, 200);
  }
  assert.deepEqual(forwarded.map(p => p.action), ["confirm", "unsubscribe"]);
  assert.deepEqual(budgets.map(b => b.limit), [100, 20, 20]);
  assert.equal(new Set(budgets.map(b => b.key)).size, 3);
  assert.equal(budgets.some(b => b.key.includes("a".repeat(64))), false);
  assert.equal((await exports.POST(request({ action: "unsubscribe", token: "invalid" }))).status, 400);
  assert.equal(budgets.length, 3);
});
