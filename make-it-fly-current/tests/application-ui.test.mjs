import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const helperSource = await read("components/application/application-client.ts");
const { outputText } = ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });

function loadHelpers({ search = "", referrer = "", initialStorage = null, storageDisabled = false } = {}) {
  const exports = {};
  let stored = initialStorage;
  const storage = {
    getItem() { if (storageDisabled) throw new Error("Storage unavailable"); return stored; },
    setItem(_key, value) { if (storageDisabled) throw new Error("Storage unavailable"); stored = value; },
  };
  new Function("exports", "window", "document", "sessionStorage", outputText)(exports,
    { location: { search, origin: "https://makeitfly.vercel.app" } }, { referrer }, storage);
  return { ...exports, getStored: () => stored };
}

const values = { name: "Teste Interno", email: "qa@example.com", phone: "+1 (202) 555-0101", age: "28", profession: "Design de produto", hasIdea: null, ideaDescription: "", hasLaptop: null, usesPaidAI: null, website: "" };

test("profile validation requires contact, age and profession", () => {
  const { validateStep } = loadHelpers();
  assert.deepEqual(validateStep(values, 0), {});
  assert.deepEqual(Object.keys(validateStep({ ...values, name: " ", email: "invalid", phone: "123", age: "", profession: " " }, 0)), ["name", "email", "phone", "age", "profession"]);
  for (const phone of ["+12025550101", "(202) 555-0101", "+55 (48) 99999-0000", "123456789012345"]) assert.deepEqual(validateStep({ ...values, phone }, 0), {});
  for (const phone of ["123456789", "1234567890123456", "202abc5550101", "++12025550101"]) assert.ok(validateStep({ ...values, phone }, 0).phone);
  for (const age of ["1", "18", "35", "120"]) assert.deepEqual(validateStep({ ...values, age }, 0), {});
  for (const age of ["", "0", "12.5", "121", "abc"]) assert.ok(validateStep({ ...values, age }, 0).age);
  assert.ok(validateStep({ ...values, profession: " " }, 0).profession);
  assert.ok(validateStep({ ...values, profession: "x".repeat(161) }, 0).profession);
});

test("all binary criteria need an explicit boolean, including a valid No", () => {
  const { validateStep } = loadHelpers();
  assert.ok(validateStep(values, 1).hasIdea);
  assert.ok(validateStep(values, 2).hasLaptop);
  assert.ok(validateStep(values, 2).usesPaidAI);
  for (const answer of [true, false]) {
    assert.deepEqual(validateStep({ ...values, hasIdea: answer }, 1), {});
    assert.deepEqual(validateStep({ ...values, hasLaptop: answer, usesPaidAI: answer }, 2), {});
  }
  assert.ok(validateStep({ ...values, hasIdea: "true" }, 1).hasIdea);
  assert.ok(validateStep({ ...values, hasLaptop: "false", usesPaidAI: true }, 2).hasLaptop);
  assert.ok(validateStep({ ...values, usesPaidAI: "false" }, 2).usesPaidAI);
});

test("idea text is optional and bounded, not an approval criterion", () => {
  const { validateStep } = loadHelpers();
  assert.deepEqual(validateStep({ ...values, hasIdea: true }, 1), {});
  assert.deepEqual(validateStep({ ...values, hasIdea: true, ideaDescription: "a".repeat(2000) }, 1), {});
  assert.ok(validateStep({ ...values, hasIdea: true, ideaDescription: "a".repeat(2001) }, 1).ideaDescription);
  assert.deepEqual(validateStep({ ...values, hasIdea: false, ideaDescription: "a".repeat(2001) }, 1), {});
});

test("attribution accepts only four UTM fields and strips private referrer paths", () => {
  const { attributionFromUrl } = loadHelpers();
  assert.deepEqual(attributionFromUrl("?utm_source=instagram&utm_medium=social&utm_campaign=launch&utm_content=story&email=private@example.com&token=secret", "https://example.com/person/private?email=private@example.com#secret"), {
    utmSource: "instagram", utmMedium: "social", utmCampaign: "launch", utmContent: "story", referrer: "https://example.com",
  });
  assert.deepEqual(attributionFromUrl("", "javascript:alert(1)"), {});
  assert.deepEqual(attributionFromUrl("?utm_source=%00abc%0A", ""), { utmSource: "abc" });
  assert.equal(attributionFromUrl(`?utm_campaign=${"x".repeat(200)}`, "").utmCampaign.length, 120);
});

test("landing attribution survives navigation without any contact data storage", () => {
  const landing = loadHelpers({ search: "?utm_source=instagram&email=private@example.com", referrer: "https://example.com/path?secret=123" });
  landing.rememberAttribution();
  assert.doesNotMatch(landing.getStored(), /private|secret|email|phone|name/);
  const form = loadHelpers({ initialStorage: landing.getStored(), referrer: "https://makeitfly.vercel.app/" });
  assert.deepEqual(form.readAttribution(), { utmSource: "instagram", referrer: "https://example.com" });
});

test("expired, corrupted or blocked browser storage never blocks the form", () => {
  const expired = JSON.stringify({ at: Date.now() - 31 * 60 * 1000, values: { utmSource: "old" } });
  for (const initialStorage of [expired, "invalid json", "null", JSON.stringify({ at: Date.now() + 60000, values: { utmSource: "future" } })]) {
    assert.deepEqual(loadHelpers({ initialStorage, search: "?utm_source=new" }).readAttribution(), { utmSource: "new" });
  }
  const disabled = loadHelpers({ storageDisabled: true, search: "?utm_source=new" });
  assert.doesNotThrow(() => disabled.rememberAttribution());
  assert.deepEqual(disabled.readAttribution(), { utmSource: "new" });
});

test("the UI confirms every saved application without exposing score or redirecting", async () => {
  const form = await read("components/application/ApplicationForm.tsx");
  assert.match(form, /fetch\("\/api\/applications"/);
  assert.match(form, /result\.received !== true/);
  assert.match(form, /setSubmitted\(true\)/);
  assert.match(form, /requestRef\.current\?\.signature !== signature/);
  assert.match(form, /idempotencyKey: requestRef\.current\.key/);
  assert.doesNotMatch(form, /localStorage|sessionStorage|SUPABASE|SYMPLA_CHECKOUT|safeCheckoutPath|window\.location\.assign|checkoutUrl|outcome\.eligible|hasIdea\s*&&\s*(?:values\.)?usesPaidAI/);
  assert.match(form, /method="post" action="\/api\/applications"/);
  assert.match(form, /disabled=\{submitting \|\| !hydrated\}/);
  assert.match(form, /Se sua participação for aprovada, enviaremos o link do ingresso pelo contato informado/);
  assert.match(form, /O envio desta aplicação ainda não garante uma vaga/);
  const page = await read("app/makeitfly/participar/page.tsx");
  assert.match(page, /analisamos cada aplicação e enviamos o link do ingresso a quem for selecionado/);
  assert.doesNotMatch(page, /segue direto para o ingresso/);
});

test("form accessibility includes step state, field errors, focus management and reduced motion", async () => {
  const [form, css, page] = await Promise.all([read("components/application/ApplicationForm.tsx"), read("components/application/application.module.css"), read("app/makeitfly/participar/page.tsx")]);
  assert.match(form, /aria-current=\{step === index \? "step"/);
  assert.match(form, /role="alert" tabIndex=\{-1\}/);
  assert.match(form, /\[errorAttempt\]/);
  assert.doesNotMatch(form, /errorRef\.current\?\.focus\(\);\s*\}, \[errorMessage, errors\]/);
  assert.match(form, /autoComplete="name"/);
  assert.match(form, /autoComplete="email"/);
  assert.match(form, /autoComplete="tel"/);
  assert.match(form, /Sua idade/);
  assert.match(form, /Profissão ou área de atuação/);
  assert.match(form, /notebook ou computador portátil/);
  assert.match(form, /<legend>/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /focus-visible/);
  assert.match(page, /id="experiencia"/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
});

test("all three participation CTAs reach the local form and leave Earth components intact", async () => {
  const [link, hero, landing, content] = await Promise.all([read("components/application/ApplicationLink.tsx"), read("components/hero/HeroContent.tsx"), read("components/landing/make-it-fly-v2.tsx"), read("content/site.ts")]);
  assert.match(link, /href="\/makeitfly\/participar"/);
  assert.match(link, /onClick=\{\(event\) => \{/);
  assert.match(link, /rememberAttribution\(\)/);
  assert.match(link, /trackJourney\("cta_click"/);
  assert.equal(hero.match(/<ApplicationLink\b/g)?.length, 1);
  assert.equal(landing.match(/<ApplicationLink\b/g)?.length, 2);
  assert.match(content, /href: "\/makeitfly\/participar"/);
  assert.match(landing, /<ApogeeFlight pageRef=\{pageRef\} onReadyChange=\{setEarthReady\} \/>/);
});

test("journey tracking is first-party, session-scoped and never copies form answers", async () => {
  const [client, tracker, form, layout] = await Promise.all([
    read("components/analytics/journey-client.ts"),
    read("components/analytics/JourneyTracker.tsx"),
    read("components/application/ApplicationForm.tsx"),
    read("app/layout.tsx"),
  ]);
  assert.match(client, /sessionStorage\.getItem/);
  assert.doesNotMatch(client, /localStorage/);
  assert.match(client, /navigator\.doNotTrack\s*!==\s*"1"/);
  assert.match(client, /fetch\("\/api\/journey"/);
  assert.match(client, /keepalive:\s*true/);
  assert.match(tracker, /page_view/);
  assert.match(tracker, /section_view/);
  assert.match(tracker, /scroll_depth/);
  assert.match(form, /form_step_completed/);
  assert.match(form, /form_submit_succeeded/);
  assert.match(layout, /<JourneyTracker \/>/);
  for (const privateField of ["email", "phone", "profession", "ideaDescription"]) {
    assert.doesNotMatch(client, new RegExp(privateField, "i"));
  }
});
