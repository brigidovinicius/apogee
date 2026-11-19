import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { employmentExperienceSummary } = load("lib/opportunities/employment-experience.ts");
const { toOpportunity } = load("lib/opportunities/radar-client.ts");
const { opportunityCardData } = load("lib/opportunities/card-data.ts");
const requirements = "Our company has operated for 20 years. QUALIFICATIONS AND JOB REQUIREMENTS: 5 to 10 years of experience in management consulting.";

test("Truelogic's explicit range is preserved without turning its upper bound into a minimum", () => {
  assert.equal(employmentExperienceSummary(null, requirements), "5 a 10 anos");
});

test("explicit English and Portuguese experience ranges retain both bounds", () => {
  for (const text of ["5-10 years of experience", "5–10 years experience", "5 — 10 years of relevant experience",
    "5 a 10 anos de experiência", "5 até 10 anos de experiencia", "5 TO 10 YEARS OF EXPERIENCE"]) {
    assert.equal(employmentExperienceSummary(null, text), "5 a 10 anos", text);
  }
  assert.equal(employmentExperienceSummary(null, "1 to 1 year of experience"), "1 ano");
});

test("existing structured minimums remain authoritative, including zero years", () => {
  assert.equal(employmentExperienceSummary(2, "2+ years of experience"), "2+ anos");
  assert.equal(employmentExperienceSummary(2, requirements), "2+ anos");
  assert.equal(employmentExperienceSummary(0, ""), "0+ anos");
});

test("unrelated years, ages, salaries and invalid or ambiguous ranges remain unknown", () => {
  for (const text of ["", "The company has 20 years of history.", "Age: 5 to 10 years", "USD 5 to 10 per hour",
    "5 to 10 years at the company", "10 to 5 years of experience", "5 to 61 years of experience",
    "150 to 200 years of experience", "-5 to 10 years of experience", "2.5 to 10 years of experience",
    "5 to 10 years of experience or 3 to 4 years of experience"]) {
    assert.equal(employmentExperienceSummary(null, text), "Não informada", text);
  }
});

const employment = { version: 1, provider: "ashby", postingId: "posting", requisitionId: "requisition", roleFamily: "fde",
  workplace: "remote", brazilEligibility: "confirmed", locationText: "Brazil", employmentType: "FullTime",
  experienceYears: null, languages: [], travelText: null, publishedAt: null, salary: null };
const job = toOpportunity({ id: "range-job", title: "Forward Deployed Engineer", institution: "Employer",
  benefitType: "employment", categories: ["carreira"], isCourse: false, nationallyEligible: false,
  applicantType: "mixed", stateCode: null, cityName: null, deadlineAt: null, deadlinePrecision: "not_informed",
  eventStartsAt: null, opportunityStatus: "open", officialUrl: "https://example.test/job",
  lastCheckedAt: new Date().toISOString(), requirementsText: requirements,
  amountText: "Remuneração não informada na fonte oficial.", employment });
const Card = opportunityLoader({
  "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => {
    void prefetch; return React.createElement("a", props, children);
  } },
  "@/components/site/share-button": { ShareButton: () => null },
  "./opportunity-countdown": { OpportunityCountdown: () => null },
  "./opportunity-dates": { OpportunityDates: () => null },
  "./opportunity-financials": { OpportunityBenefits: () => null, OpportunityCosts: () => null },
  "./opportunity-alert": { OpportunityAlert: () => null },
})("components/opportunities/opportunities-board.tsx").OpportunityCard;

test("the detailed production card renders the range from requirements carried through the Radar bridge", () => {
  const before = structuredClone(job);
  const html = renderToStaticMarkup(React.createElement(Card, { opportunity: job, detailed: true }));
  assert.match(html, /<dt>Experiência anunciada<\/dt><dd>5 a 10 anos<\/dd>/);
  assert.doesNotMatch(html, /<dt>Experiência anunciada<\/dt><dd>(?:Não informada|5\+ anos)/);
  assert.deepEqual(job, before);
});

test("public previews keep the experience summary and protected requirements hidden", () => {
  const preview = opportunityCardData(job);
  assert.equal(preview.eligibility, "");
  assert.equal(preview.employment.experienceYears, null);
  const html = renderToStaticMarkup(React.createElement(Card, { opportunity: preview }));
  assert.doesNotMatch(html, /Experiência anunciada|5 a 10 anos|management consulting/);
});
