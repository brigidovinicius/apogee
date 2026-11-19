import assert from "node:assert/strict";
import test from "node:test";
import { duplicateMatcher, eligibleRule, loadAutomaticRules, reviewDiscoveredBenefits } from "../scripts/automatic-benefit-review.mjs";
import { sourceSession } from "../scripts/benefit-source-check.mjs";

const rules = await loadAutomaticRules();
const rule = rules.find(rule => rule.offer);
const students = rules.find(rule => rule.sourceId === "azure-students");
const now = new Date("2026-11-19T15:00:00Z");
const reportFor = (rules, generatedAt = now.toISOString()) => ({
  status: "editorial_review", generatedAt,
  sources: rules.map(rule => ({
    id: rule.sourceId, sourceUrl: rule.sourceUrl, checkedAt: generatedAt, outcome: "observed",
    candidates: [{ key: rule.key, evidenceUrl: rule.evidenceUrl, change: "new_program" }],
  })),
});

test("publishes only a current eligible candidate with a verified provider route", async () => {
  const results = [];
  const report = reportFor([rule, students]);
  report.sources[0].candidates.push({ key: "unknown", evidenceUrl: rule.evidenceUrl, change: "new_campaign" });
  const decisions = await reviewDiscoveredBenefits(report, rules, {
    at: now,
    findDuplicate: match => match({ id: "github-education-microsoft" }),
    check: async offer => { assert.equal(offer.id, rule.offer.id); return { outcome: "verified" }; },
    publish: async (offer, isDuplicate) => {
      results.push(offer.id);
      assert.equal(offer.checkedAt, now.toISOString());
      assert.ok(isDuplicate({ id: rule.offer.id }));
      return "published";
    },
  });
  assert.deepEqual(results, [rule.offer.id]);
  assert.deepEqual(decisions.map(decision => decision.outcome), ["published", "review", "duplicate"]);
});

test("rejects expired, future and inconclusive campaigns and recognizes alternate routes", async () => {
  const offer = { ...rule.offer, ongoing: false, startsAt: "2026-11-19T12:00:00Z", endsAt: now.toISOString() };
  assert.equal(eligibleRule(offer, now), false);
  assert.equal(eligibleRule(offer, new Date("2026-11-19T11:59:59Z")), false);
  assert.equal(eligibleRule(offer, new Date("2026-11-19T14:59:59Z")), true);
  assert.equal(eligibleRule({ ...offer, tests: [] }, now), false);
  assert.ok(duplicateMatcher(rule)({ redemption_url: "https://azure.microsoft.com/pt-br/free?utm_source=catalogue" }));
  assert.ok(duplicateMatcher(rule)({ name: "Conta Gratuita do Azure", partner: "Microsoft" }));
  assert.ok(!duplicateMatcher(rule)({ id: "github-education-microsoft", evidence_url: students.evidenceUrl }));

  const publish = () => assert.fail("No publication with expired or incomplete evidence");
  const dependencies = { at: now, findDuplicate: () => false, publish, check: async () => ({ outcome: "temporary" }) };
  const stale = reportFor([rule], "2026-11-18T15:00:00Z");
  assert.deepEqual(await reviewDiscoveredBenefits(stale, rules, dependencies), []);
  assert.equal((await reviewDiscoveredBenefits(reportFor([rule]), rules, dependencies))[0].outcome, "temporary");
  const changes = reportFor([rule]);
  changes.sources[0].candidates[0].change = "terms_to_review";
  assert.equal((await reviewDiscoveredBenefits(changes, rules, dependencies))[0].outcome, "review");
});

test("validates the designated Brazilian availability evidence and follows the actual campaign link", async () => {
  const [terms] = rule.offer.tests;
  const source = href => `<p>${terms.markers.join(" ")} ${terms.brazil}</p><a href="${href}">Ativar</a>`;
  const run = ({ html = source(terms.redemption.url), destination = "https://signup.azure.com/signup?offer=ms-azr-0044p" } = {}) => {
    const checked = [];
    const verify = sourceSession(async url => {
      checked.push(url.hostname);
      if (url.hostname === "azure.microsoft.com") return { status: 200, body: html };
      if (url.hostname === "go.microsoft.com") return { status: 302, location: destination };
      return { status: 200, body: "<title>Azure - Sign up</title>" };
    });
    return { verify, checked };
  };
  assert.equal((await run().verify(rule.offer)).outcome, "verified");
  assert.equal((await run({ html: source(terms.redemption.url).replace(terms.brazil, "Português (Brasil)") }).verify(rule.offer)).outcome, "review");
  assert.equal((await run({ html: source("/pt-br/") }).verify(rule.offer)).outcome, "review");
  assert.equal((await run({ destination: "https://signup.azure.com/signup?offer=not-this-campaign" }).verify(rule.offer)).outcome, "review");
  const redirect = run({ destination: "https://outside.example/signup?offer=ms-azr-0044p" });
  assert.equal((await redirect.verify(rule.offer)).outcome, "unavailable");
  assert.deepEqual(redirect.checked, ["azure.microsoft.com", "go.microsoft.com"]);
  assert.equal((await run().verify({ tests: [] })).outcome, "review");
});

test("publishes a documented in-app route only while both suppliers confirm the same Brazilian campaign", async () => {
  const samsung = rules.find(rule => rule.sourceId === "samsung-google-ai-pro-br");
  const { offer } = samsung;
  const [terms, regulation] = offer.tests;
  const { inAppSteps, url: link } = regulation.redemption;
  const termsText = [...terms.markers, terms.brazil].join(" ");
  const stepsText = [...regulation.markers, ...inAppSteps].join(" ");
  const verify = ({
    text = termsText, steps = stepsText, href = link, redirect,
  } = {}) => sourceSession(async url => {
    if (url.hostname === "one.google.com" && !url.search && redirect) return { status: 302, location: redirect };
    return {
      status: 200,
      body: url.hostname === "one.google.com" ? `<p>${text}</p>` : `<p>${steps}</p><a href="${href}">Termos</a>`,
    };
  });

  assert.equal(eligibleRule(offer, now), true);
  assert.equal(eligibleRule(offer, new Date(offer.endsAt)), false);
  assert.equal(eligibleRule({
    ...offer, tests: [terms, { ...regulation, redemption: { ...regulation.redemption, inAppSteps: [] } }],
  }, now), false);
  assert.equal((await verify({ text: termsText.replace(terms.brazil, "Português (Brasil)") })(offer)).outcome, "review");
  assert.equal((await verify({ steps: stepsText.replace(inAppSteps[1], "") })(offer)).outcome, "review");
  assert.equal((await verify({ href: "https://one.google.com/" })(offer)).outcome, "review");
  assert.equal((await verify({ redirect: link + "?other_campaign=1" })(offer)).outcome, "review");

  const publish = async (candidate, match) => {
    assert.equal(candidate.id, offer.id);
    assert.ok(match({ redemption_url: "https://www.samsung.com/br/offer/gemini/?utm_source=other" }));
    return "published";
  };
  const decide = (findDuplicate, check = verify()) => reviewDiscoveredBenefits(reportFor([samsung]), rules, { at: now, check, findDuplicate, publish });
  assert.equal((await decide(() => false))[0].outcome, "published");
  assert.equal((await decide(match => match({ evidence_url: terms.url }), () => assert.fail("Already in catalogue")))[0].outcome, "duplicate");
});
