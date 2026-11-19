import assert from "node:assert/strict";
import test from "node:test";
import { packCampaigns, sourceSession } from "../scripts/benefit-source-check.mjs";
import { loadBenefitOffers, indexOffers } from "../scripts/member-benefits-monitor.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const official = "https://vendor.example";
const promo = { tests: [{ url: official + "/benefit", hosts: ["vendor.example"], paths: ["/apply"], markers: ["student plan", "30% discount"], ended: ["no longer accepting applications"] }] };

test("compares the named campaign and redemption route, including provider closures with HTTP 200", async () => {
  const run = html => sourceSession(async url => url.pathname === "/benefit"
    ? { status: 302, location: "/apply" }
    : { status: 200, body: html })(promo);
  assert.equal((await run("<h1>Student plan</h1><p>30% discount</p>")).outcome, "verified");
  assert.equal((await run("<h1>Student plan</h1><p>30% discount, no longer accepting applications</p>")).outcome, "unavailable");
  assert.equal((await run("<h1>Student plan</h1><script>30% discount</script><p>15% discount</p>")).outcome, "review");
});

test("classifies temporary failures and stops a redirect before reaching a nonofficial host", async () => {
  assert.equal((await sourceSession(async () => ({ status: 429 }))(promo)).outcome, "temporary");
  let fetched = 0;
  const verify = sourceSession(async () => { fetched++; return { status: 302, location: "https://elsewhere.example/apply" }; });
  assert.equal((await verify(promo)).outcome, "unavailable");
  assert.equal(fetched, 1);
});

test("confirms that the specific offer still exists in the official program and its terms match", async () => {
  const example = term => `<main><a href="https://github.com/settings/education/benefits">Sign up</a>
    <h3 id="vendor" class="sr-only">Vendor</h3><h5>Offer</h5><p>${term}</p>
    <h3 id="other" class="sr-only">Other</h3><h5>Offer</h5><p>Unrelated terms</p></main>`;
  const baseline = example("Free for 12 months.");
  const [hash] = packCampaigns(baseline).get("vendor");
  const offer = { tests: [{ url: "https://education.github.com/pack", hosts: ["education.github.com"], paths: ["/pack"], pack: "vendor", hashes: [hash] }] };
  const verify = html => sourceSession(async () => ({ status: 200, body: html }))(offer);
  assert.equal((await verify(baseline)).outcome, "verified");
  assert.equal((await verify(example("Free for 6 months."))).outcome, "review");
  assert.equal((await verify(baseline.replace('id="vendor"', 'id="different"'))).outcome, "unavailable");
  assert.equal((await verify(baseline.replace('https://github.com/settings/education/benefits', '#'))).outcome, "review");
});

test("candidate catalog contains distinct campaigns on official HTTPS endpoints with evidence per offer", async () => {
  const offers = await loadBenefitOffers();
  assert.ok(offers.length >= 100);
  assert.equal(indexOffers(offers).size, offers.length);
  assert.equal(new Set(offers.map(offer => offer.id)).size, offers.length);
  for (const { condition, eligibility, source, redeem, tests } of offers) {
    assert.ok(condition && eligibility && tests.length);
    assert.equal(new URL(source).protocol, "https:");
    assert.equal(new URL(redeem).protocol, "https:");
  }
  const rosa = offers.find(offer => offer.id === "hostgator-rosa");
  assert.equal(rosa.sort, 0);
  assert.equal(rosa.redeem, "https://www.hostgator.com.br/53289-77-3-32.html");
  assert.equal(rosa.tests[0].query.utm_content, "53289");
});

test("all catalogue destinations pass the real member validator, with fragments restricted to listed campaigns", async () => {
  const { officialBenefitUrl, officialUrl } = opportunityLoader()("lib/deliverables/validation.ts");
  const offers = await loadBenefitOffers();
  for (const offer of offers) {
    assert.equal(officialBenefitUrl.safeParse(offer.source).success, true, offer.id);
    assert.equal(officialBenefitUrl.safeParse(offer.redeem).success, true, offer.id);
  }
  const pack = offers.find(offer => offer.id === "github-education-namecheap").redeem;
  assert.equal(officialUrl.safeParse(pack).success, false);
  for (const url of [pack + "?token=value", pack.replace("#namecheap", "?token=value#namecheap"),
    pack.replace("#namecheap", "#unknown"), pack.replace("education.github.com", "education.github.com.example.org")]) {
    assert.equal(officialBenefitUrl.safeParse(url).success, false);
  }
});
