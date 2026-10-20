import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as realSetTimeout } from "node:timers";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const origin = "https://www.apogee.community";
const env = {
  NODE_ENV: "production", APPLICATION_ORIGIN: origin,
  APPLICATION_SIGNING_SECRET: "synthetic-body-test-secret-at-least-32-characters",
  SUPABASE_URL: "https://synthetic.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_synthetic01234567890123456789",
};
class InvitationError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function fixture(session = null) {
  const load = opportunityLoader({
    "./auth": { getAuth: () => ({ api: { getSession: async () => session } }) },
    "./mail": { applicationOrigin: () => origin },
    "./invitations": { InvitationError },
    "@/lib/members/invitations": { InvitationError },
    "./db": {}, "./schema": {}, "./gallery-repository": {},
    "./data": { getAdminPost: async () => ({ id: 1 }) },
    "@/lib/members/auth": {}, "@/lib/members/db": {}, "@/lib/members/schema": {},
    "@/lib/members/mail": {}, "@/lib/members/rate-limit": {},
  });
  return load;
}
function streamRequest(prefix = "{", { multipart = false, method = "POST", headers = {}, cancel } = {}) {
  let controller;
  let cancellations = 0;
  const body = new ReadableStream({
    start(value) { controller = value; if (prefix) value.enqueue(new TextEncoder().encode(prefix)); },
    cancel() { cancellations++; return cancel?.(); },
  }, { highWaterMark: 0 });
  const request = new Request(`${origin}/api/test`, {
    method, body, duplex: "half",
    headers: { origin, "content-type": multipart ? "multipart/form-data; boundary=synthetic" : "application/json", ...headers },
  });
  return { request, controller, cancellations: () => cancellations };
}
const flush = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
async function outcome(operation) {
  try {
    const value = await operation;
    return value instanceof Response ? value.status : "accepted";
  } catch (error) { return error.status ?? error.message; }
}
async function within(operation) {
  let timer;
  try { return await Promise.race([operation, new Promise(resolve => { timer = realSetTimeout(() => resolve("pending"), 60); })]); }
  finally { clearTimeout(timer); }
}
const options = { env, rateLimiter: () => true, fetcher: () => { throw new Error("No external requests allowed"); } };
const consumers = [
  ["invitations", (load, r) => load("lib/members/invitation-http.ts").invitationBody(r)],
  ["applications", (load, r) => load("lib/applications.ts").handleApplicationPost(r, options)],
  ["journey", (load, r) => load("lib/journey.ts").handleJourneyPost(r, options)],
  ["gallery upload", (load, r) => load("lib/gallery.ts").uploadCommunityPhoto(r), { multipart: true }],
  ["gallery deletion", (load, r) => load("lib/gallery.ts").manageCommunityPhotos(r, { memberRole: "admin" }), { method: "DELETE" }],
  ["avatar", (load, r) => load("lib/members/avatar.ts").boundedAvatarForm(r), { multipart: true }],
  ["blog media", (load, r) => load("lib/blog/media.ts").uploadBlogMedia(r, 1), { multipart: true }],
  ["alerts", (load, r) => load("lib/opportunities/radar-alerts-client.ts").readAlertBody(r)],
];
for (const [name, run, init] of consumers) {
  test(`${name}: an unfinished upload times out, cancels and releases its reader`, async (t) => {
    process.env.BETTER_AUTH_SECRET = "synthetic-gallery-secret-at-least-32-characters";
    const load = fixture();
    const stream = streamRequest("{", init);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let settled = false;
    const operation = outcome(run(load, stream.request)).then(value => { settled = true; return value; });
    await flush(); t.mock.timers.tick(init?.multipart ? 29_999 : 4_999); await flush();
    assert.equal(settled, false, "legitimate uploads retain their full time budget");
    t.mock.timers.tick(2); await flush();
    const result = await within(operation);
    if (result === "pending") { stream.controller.close(); await operation; }
    assert.equal(result, 408);
    assert.equal(stream.cancellations(), 1);
    assert.equal(stream.request.body.locked, false);
  });
}
test("alerts: a valid JSON prefix without EOF must not be accepted at timeout", async (t) => {
  const load = fixture(); const stream = streamRequest("{}");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const operation = outcome(load("lib/opportunities/radar-alerts-client.ts").readAlertBody(stream.request));
  await flush(); t.mock.timers.tick(5001); await flush();
  const result = await within(operation);
  if (result === "pending") { stream.controller.close(); await operation; }
  assert.equal(result, 408);
});
for (const route of ["invitations", "verification"]) {
  test(`${route}: unauthenticated requests return 401 without consuming the body`, async () => {
    const load = fixture(null);
    const request = new Request(`${origin}/api/members/${route}`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: "{",
    });
    const response = await load(`app/api/members/${route}/route.ts`).POST(request);
    assert.equal(response.status, 401); assert.equal(request.bodyUsed, false);
  });
}

test("reader: accepts the exact byte limit and releases the reader on EOF", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const request = new Request(`${origin}/`, { method: "POST", body: "éé" });
  assert.equal((await read(request, 4)).toString("utf8"), "éé");
  assert.equal(request.body.locked, false);
});
test("reader: counts actual UTF-8 bytes despite a smaller declared length", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const stream = streamRequest("ééé", { headers: { "content-length": "1" } });
  assert.equal(await outcome(read(stream.request, 4)), 413);
  assert.equal(stream.cancellations(), 1); assert.equal(stream.request.body.locked, false);
});
test("reader: rejects invalid/oversized declared lengths before pulling bytes", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  for (const length of ["-1", "NaN", "1.5", "999999999999999999999999999999", "5"]) {
    let pulls = 0; let cancels = 0;
    const body = new ReadableStream({ pull() { pulls++; }, cancel() { cancels++; } }, { highWaterMark: 0 });
    const request = new Request(`${origin}/`, { method: "POST", body, duplex: "half", headers: { "content-length": length } });
    assert.equal(await outcome(read(request, 4)), 413);
    assert.equal(pulls, 0); assert.equal(cancels, 1); assert.equal(body.locked, false);
  }
});
test("reader: the whole-body deadline is not extended by successful chunks", async (t) => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const stream = streamRequest("{");
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const operation = outcome(read(stream.request, 4096));
  await flush(); t.mock.timers.tick(4000);
  stream.controller.enqueue(new TextEncoder().encode('"a":1')); await flush();
  t.mock.timers.tick(1001); await flush();
  assert.equal(await within(operation), 408); assert.equal(stream.request.body.locked, false);
});
for (const cancel of [() => new Promise(() => {}), () => Promise.reject(new Error("synthetic cancel failure"))]) {
  test(`reader: timeout settles even when source cleanup ${cancel.toString().includes("reject") ? "rejects" : "hangs"}`, async (t) => {
    const read = fixture()("lib/request-body.ts").readRequestBody;
    const stream = streamRequest("{}", { cancel });
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const operation = outcome(read(stream.request, 4096));
    await flush(); t.mock.timers.tick(5001); await flush();
    assert.equal(await within(operation), 408);
    assert.equal(stream.cancellations(), 1); assert.equal(stream.request.body.locked, false);
  });
}
test("reader: client abort cancels a stalled read without awaiting its deadline", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const stream = streamRequest("{}"); const controller = new AbortController();
  const request = new Request(stream.request, { signal: controller.signal });
  const operation = outcome(read(request, 4096)); await flush(); controller.abort();
  assert.equal(await within(operation), 400); assert.equal(stream.cancellations(), 1);
  assert.equal(request.body.locked, false);
});
test("reader: an already aborted request with a complete body cannot succeed", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const controller = new AbortController(); controller.abort();
  const body = new ReadableStream({ start(c) { c.close(); } });
  const request = new Request(`${origin}/`, { method: "POST", body, duplex: "half", signal: controller.signal });
  assert.equal(await outcome(read(request, 4096)), 400); assert.equal(body.locked, false);
});
test("reader: a stream failure returns a generic error and releases the lock", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const body = new ReadableStream({ pull(c) { c.error(new Error("synthetic private transport details")); } });
  const request = new Request(`${origin}/`, { method: "POST", body, duplex: "half" });
  await assert.rejects(read(request, 4096), error => error.status === 400 && !error.message.includes("private"));
  assert.equal(body.locked, false);
});
test("reader: a real timer rejects an unfinished body without any clock mock", async () => {
  const read = fixture()("lib/request-body.ts").readRequestBody;
  const stream = streamRequest("{}");
  assert.equal(await outcome(read(stream.request, 4096, 20)), 408);
  assert.equal(stream.cancellations(), 1); assert.equal(stream.request.body.locked, false);
});
test("bounded forms and JSON still parse complete legitimate requests", async () => {
  const load = fixture();
  const json = new Request(`${origin}/api/test`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"action":"accept"}' });
  assert.deepEqual(await load("lib/members/invitation-http.ts").invitationBody(json), { action: "accept" });
  const form = new FormData(); form.append("label", "Foto de teste");
  const request = new Request(`${origin}/api/test`, { method: "POST", body: form });
  assert.equal((await load("lib/members/avatar.ts").boundedAvatarForm(request)).get("label"), "Foto de teste");
  assert.equal(request.body.locked, false);
});
