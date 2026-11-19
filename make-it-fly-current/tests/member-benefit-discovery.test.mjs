import assert from "node:assert/strict";
import test from "node:test";
import { packCampaigns, sourceSession } from "../scripts/benefit-source-check.mjs";
import { discoverBenefitCandidates } from "../scripts/member-benefit-discovery.mjs";

const pack = "https://education.github.com/pack";
const adobe = "https://www.adobe.com";
const adobeIndex = adobe + "/br/products/special-offers.html";
const term = name => "/br/offer-terms/" + name + ".html";
const index = (id, kind, url) => ({ id, kind, url, provider: id, audience: "geral" });
const html = body => ({ status: 200, body });

test("reports an unlisted Student Pack campaign and changed terms with the same official anchor", async () => {
  const card = (id, terms) => `<h3 id="${id}" class="sr-only">${id}</h3><h5>Offer</h5><p>${terms}</p>`;
  const body = '<main><a href="https://github.com/settings/education/benefits">Apply</a>' +
    card("known", "Free for eligible students") + card("changed", "Free for 6 months") +
    card("new", "20% off for a year") + card("duplicate", "20% off for a year") +
    card("regular-tool", "Open Source by GitHub, free for everyone.") +
    '<script>' + card("fake", "50% off") + '</script></main>';
  const baseline = packCampaigns(card("known", "Free for eligible students") + card("changed", "Free for 12 months"));
  const approved = [...baseline].map(([id, hashes]) => ({
    source: pack + "#" + id,
    redeem: pack + "#" + id,
    tests: [{ url: pack, pack: id, hashes }],
  }));
  const report = await discoverBenefitCandidates([index("github", "github-education", pack)], approved,
    () => sourceSession(async () => html(body)));
  assert.equal(report.status, "editorial_review");
  assert.equal(report.sources[0].outcome, "observed");
  assert.deepEqual(report.sources[0].candidates.map(({ key, change, evidenceUrl }) => [key, change, evidenceUrl]), [
    ["changed", "terms_changed", pack + "#changed"],
    ["new", "new_campaign", pack + "#new"],
  ]);
});

test("reads distinct same-origin Adobe terms and exposes gated or inconclusive pages", async () => {
  const landing = `<a href="${term("personal")}">Terms</a><a href="${term("personal")}?tracking=1">Duplicate</a>
    <a href="${term("students")}">Terms</a><a href="${term("blocked")}">Terms</a>
    <a href="${term("closed")}">Terms</a><a href="${term("expired")}">Terms</a>
    <a href="https://example.net${term("outside")}">Third party</a>
    <template><a href="${term("inactive")}">Archived</a></template>`;
  const hits = [];
  const report = await discoverBenefitCandidates([index("adobe", "adobe-br", adobeIndex)], [
    { source: adobe + term("students"), redeem: adobeIndex, tests: [{
      url: adobe + term("students"), hosts: ["www.adobe.com"], paths: [term("students")], markers: ["oferta por R$ 19,99"],
    }] },
  ], () => sourceSession(async url => {
    hits.push(url.href);
    if (url.href === adobeIndex) return html(landing);
    if (url.pathname === term("blocked")) return { status: 429 };
    if (url.pathname === term("closed")) return html("<h1>Termos e condições</h1><p>Esta página já não está disponível.</p>");
    if (url.pathname === term("expired")) return html("<h1>Termos e condições</h1><p>Oferta por R$ 50 até 1 de janeiro de 2020.</p>");
    return html("<h1>Termos e condições</h1><p>Oferta por R$ 79,99.</p>");
  }));
  const source = report.sources[0];
  assert.equal(source.outcome, "partial");
  assert.deepEqual(source.candidates.map(({ evidenceUrl, change }) => [evidenceUrl, change]), [
    [adobe + term("personal"), "new_campaign"],
    [adobe + term("students"), "terms_to_review"],
  ]);
  assert.deepEqual(source.unresolved.map(page => page.outcome), ["temporary", "review", "unavailable"]);
  assert.deepEqual(hits, [adobeIndex, ...["personal", "students", "blocked", "closed", "expired"].map(name => adobe + term(name))]);
});

test("checks programme conditions even when HTTP reports success and excludes known campaign URLs", async () => {
  const direct = {
    ...index("direct", "program", "https://vendor.example/benefits/"),
    markers: ["eligible students", "20% off"],
    verify: "Conferir região.",
  };
  const verified = html("<h1>20% off for eligible students</h1>");
  const run = (page, approved = []) => discoverBenefitCandidates([direct], approved, () => sourceSession(async () => page));
  const report = await run(verified);
  assert.equal(report.sources[0].candidates[0].change, "new_program");
  assert.equal((await run(html("<p>20% off.</p>"))).sources[0].outcome, "review");
  assert.equal((await run(html("<p>20% off for eligible students. Applications are closed.</p>"))).sources[0].outcome, "unavailable");
  assert.equal((await run(verified, [{
    source: "https://vendor.example/benefits",
    redeem: direct.url,
    tests: [{ url: direct.url, hosts: ["vendor.example"], paths: ["/benefits"], markers: direct.markers }],
  }])).sources[0].candidates.length, 0);
});

test("continues with the next source when the previous source redirects off-domain", async () => {
  const sources = [index("adobe", "adobe-br", adobeIndex), {
    ...index("direct", "program", "https://vendor.example/benefits"),
    markers: ["apply now"],
  }];
  const hits = [];
  const report = await discoverBenefitCandidates(sources, [], () => sourceSession(async url => {
    hits.push(url.href);
    if (url.href === adobeIndex) return { status: 302, location: "https://example.net/" };
    return html("<h1>Apply now</h1>");
  }));
  assert.deepEqual(report.sources.map(source => source.outcome), ["unavailable", "observed"]);
  assert.deepEqual(hits, [adobeIndex, sources[1].url]);
});

test("keeps the last observed candidate as stale during temporary failures and clears it on closure", async () => {
  const source = { ...index("direct", "program", "https://vendor.example/benefits"), markers: ["apply now"] };
  const run = (page, previous) => discoverBenefitCandidates([source], [], () => sourceSession(async () => page), previous?.sources);
  const first = await run(html("<h1>Apply now</h1>"));
  const failed = await run({ status: 502 }, first);
  const retry = await run({ status: 429 }, failed);
  assert.deepEqual(retry.sources[0].candidates, []);
  assert.deepEqual(retry.sources[0].staleCandidates, [{ ...first.sources[0].candidates[0], checkedAt: first.sources[0].checkedAt }]);
  const closed = await run({ status: 410 }, retry);
  assert.equal(closed.sources[0].staleCandidates, undefined);
});
