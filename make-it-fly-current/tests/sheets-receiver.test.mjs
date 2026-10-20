import assert from "node:assert/strict";
import test from "node:test";
import { application, journey, sheetsReceiver, SHEETS_SECRET } from "./helpers/sheets-receiver.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function noAccess(receiver) {
  assert.equal(receiver.calls.locks, 0); assert.equal(receiver.calls.opens, 0);
  assert.equal(receiver.rows.applications.length, 0); assert.equal(receiver.rows.journey.length, 0);
}
for (const kind of ["application", "journey_events"]) {
  test(`${kind}: missing, wrong and non-string credentials cannot acquire locks or write`, () => {
    for (const secret of [undefined, null, false, 42, {}, [], "", "wrong-secret-at-least-32-characters", `${SHEETS_SECRET}x`, SHEETS_SECRET.slice(0, -1)]) {
      const receiver = sheetsReceiver();
      const body = kind === "application" ? application() : { kind, events: [journey()] };
      body.webhookSecret = secret;
      assert.equal(receiver.post(body).received, false); noAccess(receiver);
    }
  });
}
test("missing/invalid Script Properties or property failure fail closed before resources", () => {
  for (const options of [{ secret: null }, { secret: "" }, { secret: "x".repeat(31) }, { secret: "x".repeat(257) }, { propertyFailure: true }]) {
    const receiver = sheetsReceiver(options); const response = receiver.post(application());
    assert.equal(response.received, false); noAccess(receiver);
    assert.ok(!JSON.stringify(response).includes(SHEETS_SECRET)); assert.equal(receiver.calls.logs, 0);
  }
});
test("only current configured credential is accepted after rotation", () => {
  const receiver = sheetsReceiver(); receiver.state.secret = "rotated-synthetic-secret-1234567890abcdef";
  assert.equal(receiver.post(application()).received, false); noAccess(receiver);
  assert.equal(receiver.post(application({ webhookSecret: receiver.state.secret })).received, true);
  assert.equal(receiver.rows.applications.length, 1);
});
test("malformed JSON, shapes and oversized UTF-8 bodies fail before locks", () => {
  for (const raw of ["{", "null", "[]", "42", JSON.stringify({ ...application(), padding: "a".repeat(32768) }),
    JSON.stringify({ ...application(), padding: "é".repeat(17000) })]) {
    const receiver = sheetsReceiver(); assert.equal(receiver.raw(raw).received, false); noAccess(receiver);
  }
});
test("authenticated unknown kinds, fields and invalid application formats are rejected", () => {
  for (const change of [{ kind: undefined }, { kind: "admin" }, { admin: true }, { id: "a".repeat(36) },
    { id: {} }, { createdAt: 0 }, { createdAt: "invalid" }, { email: "bad" }, { phone: "abc" },
    { age: "28" }, { age: 0 }, { profession: "" }, { name: "x\u0000y" }]) {
    const receiver = sheetsReceiver(); assert.equal(receiver.post(application(change)).received, false); noAccess(receiver);
  }
});
test("eligibility claims cannot override the age/equipment/idea/AI rules", () => {
  for (const change of [{ age: 17 }, { age: 36 }, { hasIdea: false }, { hasLaptop: false }, { usesPaidAI: false }, { eligible: false }]) {
    const receiver = sheetsReceiver(); assert.equal(receiver.post(application(change)).received, false); noAccess(receiver);
  }
});
for (const age of [17, 18, 35, 36]) {
  test(`age ${age}: all combinations preserve calculated eligibility`, () => {
    for (const hasIdea of [false, true]) for (const hasLaptop of [false, true]) for (const usesPaidAI of [false, true]) {
      const eligible = (age === 18 || age === 35) && hasIdea && hasLaptop && usesPaidAI;
      const receiver = sheetsReceiver();
      assert.equal(receiver.post(application({ age, hasIdea, hasLaptop, usesPaidAI, eligible })).received, true);
      assert.equal(receiver.rows.applications[0][8], eligible ? "Alinhado" : "Revisar");
      assert.equal(receiver.calls.releases, 1);
    }
  });
}
test("authenticated application retries are deduplicated and formulas remain text", () => {
  const receiver = sheetsReceiver(); const body = application({ name: " =IMPORTXML(\"x\")", ideaDescription: "+SUM(1,2)", profession: "@SUM(1)" });
  assert.equal(receiver.post(body).received, true);
  assert.equal(receiver.post({ ...body, id: body.id.toUpperCase() }).received, true);
  assert.equal(receiver.rows.applications.length, 1);
  assert.match(receiver.rows.applications[0][2], /^'=/); assert.match(receiver.rows.applications[0][6], /^'\+/);
  assert.match(receiver.rows.applications[0][15], /^'@/);
  assert.ok(!JSON.stringify(receiver.rows).includes(SHEETS_SECRET));
});
test("journey batches validate every item before touching Sheets and reject extra fields", () => {
  for (const change of [{ eventId: "a".repeat(36) }, { journeyId: null }, { eventName: "admin" }, { context: "=SUM(1)" },
    { step: 4 }, { receivedAt: 123 }, { email: "person@example.test" }]) {
    const receiver = sheetsReceiver();
    assert.equal(receiver.post({ kind: "journey_events", webhookSecret: SHEETS_SECRET, events: [journey(), journey(change)] }).received, false);
    noAccess(receiver);
  }
  for (const events of [[], Array.from({ length: 21 }, () => journey())]) {
    const receiver = sheetsReceiver(); assert.equal(receiver.post({ kind: "journey_events", webhookSecret: SHEETS_SECRET, events }).received, false); noAccess(receiver);
  }
});
test("journey events deduplicate within batch and across retries, including UUID casing", () => {
  const receiver = sheetsReceiver(); const item = journey();
  const body = { kind: "journey_events", webhookSecret: SHEETS_SECRET, events: [item, { ...item, eventId: item.eventId.toUpperCase() }] };
  assert.equal(receiver.post(body).received, true); assert.equal(receiver.post(body).received, true);
  assert.equal(receiver.rows.journey.length, 1); assert.equal(receiver.calls.releases, 2);
});
test("lock/Sheets failures return a sanitized negative acknowledgement and release acquired locks", () => {
  for (const options of [{ lockFailure: true }, { sheetFailure: true }]) {
    const receiver = sheetsReceiver(options); const response = receiver.post(application());
    assert.equal(response.received, false); assert.ok(!JSON.stringify(response).includes(SHEETS_SECRET));
    assert.equal(receiver.calls.releases, options.lockFailure ? 0 : 1); assert.equal(receiver.calls.logs, 0);
  }
});

for (const configuredSecret of [SHEETS_SECRET, "wrong-but-valid-server-secret-1234567890"]) {
  test(`actual site senders reach receiver; credential ${configuredSecret === SHEETS_SECRET ? "matches" : "mismatch preserves primary save"}`, async () => {
    const receiver = sheetsReceiver();
    const load = opportunityLoader(); const applications = load("lib/applications.ts"); const events = load("lib/journey.ts");
    const origin = "https://app.example.test";
    const webhook = "https://script.google.com/macros/s/abcdefghijklmnopqrstuvwxyz123456/exec";
    const env = { NODE_ENV: "production", APPLICATION_ORIGIN: origin, APPLICATION_SIGNING_SECRET: "synthetic-signing-secret-1234567890abcd",
      SUPABASE_URL: "https://synthetic-project.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_synthetic_12345678901234567890",
      GOOGLE_SHEETS_WEBHOOK_URL: webhook, GOOGLE_SHEETS_WEBHOOK_SECRET: configuredSecret };
    let databaseCalls = 0; let sheetCalls = 0;
    const fetcher = async (url, init) => {
      if (url === webhook) { sheetCalls++; return Response.json(receiver.raw(init.body)); }
      databaseCalls++;
      if (url.startsWith(`${env.SUPABASE_URL}/rest/v1/applications?`)) {
        assert.equal(init.method, "POST"); const saved = JSON.parse(init.body);
        return Response.json([{ id: application().id, created_at: "2026-10-20T12:00:00Z", eligible: true, status: "APPROVED", payload_hash: saved.payload_hash }], { status: 201 });
      }
      assert.equal(url, `${env.SUPABASE_URL}/rest/v1/journey_events`); return new Response(null, { status: 201 });
    };
    const post = (path, body) => new Request(`${origin}${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await applications.handleApplicationPost(post("/api/applications", { name: "Pessoa Sintética", email: "person@example.test", phone: "11999999999", age: 28,
      profession: "Design", hasIdea: true, hasLaptop: true, usesPaidAI: true, journeyId: application().id, idempotencyKey: journey().eventId }), { env, fetcher, rateLimiter: () => true });
    assert.equal(result.status, 201); assert.deepEqual(await result.json(), { received: true });
    const item = journey(); delete item.receivedAt;
    const tracked = await events.handleJourneyPost(post("/api/journey", { events: [item] }), { env, fetcher, rateLimiter: () => true });
    assert.equal(tracked.status, 202); assert.deepEqual(await tracked.json(), { received: true });
    assert.equal(databaseCalls, 2); assert.equal(sheetCalls, 2);
    const expected = configuredSecret === SHEETS_SECRET ? 1 : 0;
    assert.equal(receiver.rows.applications.length, expected); assert.equal(receiver.rows.journey.length, expected);
    assert.ok(!JSON.stringify(receiver.rows).includes(configuredSecret));
  });
}
