import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const applicationsSource = await readFile(new URL("../lib/applications.ts", import.meta.url), "utf8");
const applicationsOutput = ts.transpileModule(applicationsSource.replace('import "server-only";', ""), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const applicationsUrl = `data:text/javascript;base64,${Buffer.from(applicationsOutput).toString("base64")}`;
const journeySource = await readFile(new URL("../lib/journey.ts", import.meta.url), "utf8");
const journeyOutput = ts.transpileModule(
  journeySource.replace('import "server-only";', "").replace('from "@/lib/applications"', `from "${applicationsUrl}"`),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const api = await import(`data:text/javascript;base64,${Buffer.from(journeyOutput).toString("base64")}`);

const ORIGIN = "https://makeitfly.vercel.app";
const env = {
  NODE_ENV: "production",
  APPLICATION_ORIGIN: ORIGIN,
  APPLICATION_SIGNING_SECRET: "test-secret-not-for-production-1234567890",
  SUPABASE_URL: "https://test-project.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_testonly012345678901234567890",
};
const WEBHOOK_SECRET = "test-sheets-webhook-secret-1234567890";

function event(overrides = {}) {
  return { eventId: randomUUID(), journeyId: randomUUID(), eventName: "page_view", path: "/", context: "landing", step: null, device: "desktop", ...overrides };
}

function request(events, headers = {}) {
  return new Request(`${ORIGIN}/api/journey`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: typeof events === "string" ? events : JSON.stringify({ events }),
  });
}

const options = (fetcher, changes = {}) => ({ env, fetcher, rateLimiter: () => true, now: () => 1, ...changes });

test("stores a bounded event batch without PII fields or browser secrets", async () => {
  const calls = [];
  const events = [
    event(),
    event({ eventName: "section_view", context: "experiencia" }),
    event({ eventName: "form_step_completed", path: "/participar", context: "profile", step: 1, device: "mobile" }),
  ];
  const response = await api.handleJourneyPost(request(events), options(async (url, init) => {
    calls.push({ url, init });
    return new Response(null, { status: 201 });
  }));
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { received: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${env.SUPABASE_URL}/rest/v1/journey_events`);
  assert.match(calls[0].init.headers.Prefer, /resolution=ignore-duplicates/);
  const rows = JSON.parse(calls[0].init.body);
  assert.equal(rows.length, 3);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["context", "device", "event_name", "id", "journey_id", "path", "step"]);
  assert.equal(JSON.stringify(rows).includes("email"), false);
  assert.equal(JSON.stringify(rows).includes("answer"), false);
});

test("accepts every designed funnel event and rejects arbitrary names or context", async () => {
  const names = ["page_view", "section_view", "scroll_depth", "cta_click", "form_view", "form_started", "form_step_completed", "form_validation_error", "form_submit_started", "form_submit_succeeded", "form_submit_failed"];
  const ok = await api.handleJourneyPost(request(names.map((eventName) => event({ eventName }))), options(async () => new Response(null, { status: 201 })));
  assert.equal(ok.status, 202);
  for (const invalid of [
    event({ eventName: "email_captured" }),
    event({ context: "lead@example.com" }),
    event({ path: "/private" }),
    event({ step: 4 }),
    event({ device: "tablet" }),
    { ...event(), email: "private@example.com" },
  ]) {
    const response = await api.handleJourneyPost(request([invalid]), options(async () => { throw new Error("must not persist"); }));
    assert.equal(response.status, 400);
  }
});

test("origin, content type, body shape, size and batch limit fail before persistence", async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; return new Response(null, { status: 201 }); };
  const cases = [
    request([event()], { origin: "https://evil.example" }),
    request([event()], { "content-type": "text/plain" }),
    request("{broken"),
    request([]),
    request(Array.from({ length: 21 }, () => event())),
    request([event()], { "content-length": "13000" }),
  ];
  for (const item of cases) assert.ok((await api.handleJourneyPost(item, options(fetcher))).status >= 400);
  assert.equal(calls, 0);
});

test("oversized streamed bodies stop at the byte limit without Content-Length", async () => {
  let pulls = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      pulls += 1;
      if (pulls <= 2) controller.enqueue(new Uint8Array(8 * 1024));
      else controller.error(new Error("body was read past the configured limit"));
    },
    cancel() {
      cancelled = true;
    },
  }, { highWaterMark: 0 });
  const streamed = new Request(`${ORIGIN}/api/journey`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body,
    duplex: "half",
  });

  const response = await api.handleJourneyPost(streamed, options(async () => {
    throw new Error("must not persist");
  }));

  assert.equal(response.status, 413);
  assert.equal(pulls, 2);
  assert.equal(cancelled, true);
});

test("database and Sheets outages never leak details; Sheets remains best effort", async () => {
  const databaseFailure = await api.handleJourneyPost(request([event()]), options(async () => { throw new Error("private database detail"); }));
  assert.equal(databaseFailure.status, 503);
  assert.equal((await databaseFailure.text()).includes("private database detail"), false);

  const webhook = "https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz123456/exec";
  let databaseCalls = 0;
  let sheetCalls = 0;
  let sheetBody;
  const response = await api.handleJourneyPost(request([event()]), options(async (url, init) => {
    if (url === webhook) { sheetCalls += 1; sheetBody = JSON.parse(init?.body || "null"); throw new Error("private sheet detail"); }
    databaseCalls += 1;
    return new Response(null, { status: 201 });
  }, { env: { ...env, GOOGLE_SHEETS_WEBHOOK_URL: webhook, GOOGLE_SHEETS_WEBHOOK_SECRET: WEBHOOK_SECRET } }));
  assert.equal(response.status, 202);
  assert.equal(databaseCalls, 1);
  assert.equal(sheetCalls, 1);
  assert.equal(sheetBody.kind, "journey_events");
  assert.equal(sheetBody.webhookSecret, WEBHOOK_SECRET);
  assert.equal(sheetBody.events[0].receivedAt, "1970-01-01T00:00:00.001Z");
});

test("journey rate limiter expires and returns 429 without database access", async () => {
  const limiter = api.createJourneyRateLimiter(1, 1000);
  assert.equal(limiter("one", 0), true);
  assert.equal(limiter("one", 1), false);
  assert.equal(limiter("one", 1000), true);
  let calls = 0;
  const response = await api.handleJourneyPost(request([event()]), options(async () => { calls += 1; }, { rateLimiter: () => false }));
  assert.equal(response.status, 429);
  assert.equal(calls, 0);
});
