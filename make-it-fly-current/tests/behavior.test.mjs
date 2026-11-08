import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader({ "./members/db": { getSql() { throw Error("No real database in unit tests"); } } });
const contract = load("lib/behavior-contract.ts");
const api = load("lib/behavior.ts");
const origin = "https://app.example.test";
const item = (changes = {}) => ({ page: "radar_list", event: "page_view", target: "view", device: "desktop", ...changes });
const request = (events = [item()], headers = {}) => new Request(`${origin}/api/behavior`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "X-Apogee-Measurement": "allow-v1", ...headers }, body: typeof events === "string" ? events : JSON.stringify({ events }) });
const options = changes => ({ enabled: true, origin, rateLimit: () => true, store: async () => { throw Error("Unexpected write"); }, ...changes });

test("routes collapse dynamic identifiers and exclude private/token routes", () => {
  for (const [path, page] of [["/", "home"], ["/oportunidades/medical-personal-title", "radar_detail"], ["/membros/oportunidades/secret-id", "radar_detail"], ["/blog/personal-topic", "blog_article"], ["/loja", "store"], ["/membros/colecoes/abc", "collection_detail"]]) assert.equal(contract.behaviorPage(path), page);
  for (const path of ["/admin", "/admin/usuarios", "/membros/perfil/someone", "/membros/forum/private", "/membros/convite", "/membros/entrar/google/concluir", "/membros/redefinir-senha", "/api/integracoes/google-agenda/callback", "/colecoes/bearer-token", "/oportunidades/avisos", "/oportunidades/avisos/confirmar/token", "/unknown", "/oportunidades?email=person@example.test"]) assert.equal(contract.behaviorPage(path), null, path);
});
test("every vocabulary entry has a valid closed event and arbitrary values never pass", () => {
  for (const [event, targets] of Object.entries(contract.BEHAVIOR_TARGETS)) for (const target of targets) {
    const page = (event === "form_progress" || target === "application_open") ? "makeitfly_application" : event === "section_view" || target === "application_start" ? "makeitfly" : target === "store_interest" ? "store" : "radar_list";
    assert.equal(contract.validBehaviorEvent(item({ page, event, target })), true, `${event}/${target}`);
  }
  for (const extra of [{ email: "person@example.test" }, { name: "Maria" }, { userId: "123" }, { sessionId: "456" }, { url: "https://app.test?token=abc" }, { answer: "yes" }]) assert.equal(contract.validBehaviorEvent({ ...item(), ...extra }), false);
  for (const target of ["person@example.test", "maria_silva", "12345678901", "senha_secreta", "http_500_with_personal_detail", "/private?token=abc", "50.2"]) assert.equal(contract.validBehaviorEvent(item({ target })), false);
  for (const changes of [{ page: "radar_list", event: "form_progress", target: "started" }, { page: "home", event: "action", target: "save" }, { event: "toString" }, { device: { toString: () => "desktop" } }]) assert.equal(contract.validBehaviorEvent(item(changes)), false);
});
test("server aggregates before persistence and never forwards cookies or user metadata", async () => {
  let saved;
  const result = await api.handleBehaviorPost(request([item(), item(), item({ device: "mobile" })], { cookie: "auth=private", referer: "https://app.test?token=private", "user-agent": "private-device", "x-forwarded-for": "192.0.2.5" }), options({ store: async counts => { saved = counts; } }));
  assert.equal(result.status, 202);
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map(row => row.count).sort(), [1, 2]);
  assert.deepEqual(Object.keys(saved[0]).sort(), ["count", "device", "event", "page", "target"]);
  assert.doesNotMatch(JSON.stringify(saved), /private|192\.0\.2|cookie|session|user/);
});
test("disabled collection and browser refusal have no write or rate-limit side effects", async () => {
  for (const [headers, enabled] of [[{}, false], [{ dnt: "1" }, true], [{ "sec-gpc": "1" }, true]]) {
    const response = await api.handleBehaviorPost(request([item()], headers), options({ enabled, rateLimit: () => { throw Error("must not run"); } }));
    assert.equal(response.status, 204);
  }
});
test("origin, declared choice, JSON, keys, batch and body limits reject before storage", async () => {
  const cases = [
    [request([item()], { origin: "https://evil.test" }), 403], [request([item()], { "sec-fetch-site": "cross-site" }), 403],
    [request([item()], { "x-apogee-measurement": "" }), 400], [request([item()], { "content-type": "text/plain" }), 415],
    [request("{broken"), 400], [request([]), 400], [request(Array.from({ length: 21 }, () => item())), 400],
    [request([item(), item({ target: "maria_silva" })]), 400], [request('{"events":[],"userId":"private"}'), 400],
    [request("x".repeat(8193)), 413],
  ];
  for (const [req, expected] of cases) assert.equal((await api.handleBehaviorPost(req, options())).status, expected);
  assert.equal((await api.handleBehaviorPost(request(), options({ rateLimit: () => false }))).status, 429);
});
test("database errors have generic responses without data or implementation details", async () => {
  const result = await api.handleBehaviorPost(request(), options({ store: async () => { throw Error("private credential / postgres detail"); } }));
  assert.equal(result.status, 503); assert.doesNotMatch(await result.text(), /private|credential|postgres/);
});

function browser({ stored = null, dnt = "", gpc = false, blocked = false } = {}) {
  const values = new Map(stored ? [["apogee:behavior-choice:v1", stored]] : []);
  const calls = []; const timers = new Map(); let timer = 0;
  const events = new EventTarget();
  const window = { location: { pathname: "/oportunidades", origin }, matchMedia: () => ({ matches: false }), setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id), dispatchEvent: event => events.dispatchEvent(event) };
  const localStorage = { getItem(key) { if (blocked) throw Error("blocked"); return values.get(key) ?? null; }, setItem(key, value) { if (blocked) throw Error("blocked"); values.set(key, value); } };
  const source = readFileSync(new URL("../components/analytics/behavior-client.ts", import.meta.url), "utf8");
  const sandbox = { exports: {}, require: () => contract, window, localStorage, navigator: { doNotTrack: dnt, globalPrivacyControl: gpc }, Event, fetch: async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 202 }); } };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  sandbox.exports.configureBehavior(true);
  return { api: sandbox.exports, calls, values, window, timers };
}
test("client sends nothing before a choice, and revocation discards already queued events", async () => {
  const b = browser();
  b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior(); assert.equal(b.calls.length, 0);
  b.api.setBehaviorChoice("allow"); b.api.trackBehavior("page_view", "view");
  b.api.setBehaviorChoice("deny"); await b.api.flushBehavior(); assert.equal(b.calls.length, 0); assert.equal(b.timers.size, 0);
  b.api.setBehaviorChoice("allow"); b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior();
  assert.equal(b.calls.length, 1); assert.equal(b.calls[0].init.credentials, "omit"); assert.equal(b.calls[0].init.referrerPolicy, "no-referrer");
  assert.deepEqual(JSON.parse(b.calls[0].init.body), { events: [item()] });
  assert.deepEqual([...b.values.values()], ["allow"]);
});
test("DNT/GPC override a previous allow; invalid contexts and private pages never queue", async () => {
  for (const config of [{ dnt: "1" }, { gpc: true }]) { const b = browser({ stored: "allow", ...config }); b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior(); assert.equal(b.calls.length, 0); }
  const b = browser({ stored: "allow" }); b.api.trackBehavior("action", "maria_silva"); b.window.location.pathname = "/admin/usuarios"; b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior(); assert.equal(b.calls.length, 0);
});
test("blocked storage preserves the current explicit choice only in memory", async () => {
  const b = browser({ blocked: true }); b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior(); assert.equal(b.calls.length, 0);
  b.api.setBehaviorChoice("allow"); b.api.trackBehavior("page_view", "view"); await b.api.flushBehavior(); assert.equal(b.calls.length, 1);
  const fresh = browser({ blocked: true }); assert.equal(fresh.api.behaviorAllowed(), false);
});
test("old form adapter only forwards fixed progress categories and ignores context", () => {
  const calls = [];
  const adapter = opportunityLoader({ "./behavior-client": { trackBehavior: (...args) => calls.push(args), flushBehavior() {} } })("components/analytics/journey-client.ts");
  adapter.trackJourney("form_validation_error", "person@example.test,password_value", 1);
  adapter.trackJourney("form_submit_failed", "private server message", 3);
  adapter.trackJourney("form_step_completed", "private answer", 2);
  adapter.trackJourney("unknown", "secret", 1);
  assert.deepEqual(calls, [["form_progress", "validation_error"], ["form_progress", "submit_failed"], ["form_progress", "step_2"]]);
});
test("admin authorization precedes feature flags and all database reads", async () => {
  let queries = 0;
  const admin = opportunityLoader({ "./access": { requireAdmin: async () => { throw Error("denied"); } }, "@/lib/members/db": { getSql() { queries++; } } })("lib/admin/behavior.ts");
  await assert.rejects(admin.getBehaviorOverview(), /denied/); assert.equal(queries, 0);
});
test("automatic checkout measures once with prior permission and never delays submission for a refusal", async () => {
  for (const stored of [null, "allow", "deny"]) {
    const b = browser({ stored }); b.window.location.pathname = "/membros/oportunidades/synthetic-id";
    const effects = []; let refs = 0; let submissions = 0;
    const auto = opportunityLoader({
      react: { useEffect: fn => effects.push(fn), useRef: () => ++refs === 1 ? { current: { requestSubmit: () => submissions++ } } : { current: false } },
      "@/components/analytics/behavior-client": b.api,
    })("components/opportunities/automatic-detail-opening.tsx");
    const form = auto.AutomaticDetailOpening({ action: "/api/radar/checkout", checkout: true });
    effects[0](); effects[0](); await b.api.flushBehavior();
    assert.equal(submissions, 1);
    assert.equal(form.props["data-behavior-action"], undefined, "delegation cannot count the same checkout again");
    assert.equal(b.calls.length, stored === "allow" ? 1 : 0);
    if (stored === "allow") assert.deepEqual(JSON.parse(b.calls[0].init.body).events, [item({ page: "radar_detail", event: "action", target: "checkout_start" })]);
  }
});
