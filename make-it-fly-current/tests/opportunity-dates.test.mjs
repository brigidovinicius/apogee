import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { opportunityDateSummary } = load("lib/opportunities/date-summary.ts");
const { OpportunityDates } = load("components/opportunities/opportunity-dates.tsx");
const base = { categories: ["eventos"], deadline: "2026-11-09", deadlineLabel: "Inscrições até 9 de novembro", eventStartsAt: "2026-11-25" };
const markup = (item, props = {}) => renderToStaticMarkup(createElement(OpportunityDates, { opportunity: item, ...props }));

test("registration closure and event realization retain distinct dates, labels and years", () => {
  const result = opportunityDateSummary(base);
  assert.equal(result.registration.label, "Inscrições até");
  assert.equal(result.registration.dateTime, "2026-11-09");
  assert.equal(result.event.label, "Data do evento");
  assert.equal(result.event.dateTime, "2026-11-25");
  assert.match(result.registration.text, /9 de novembro de 2026/);
  assert.match(result.event.text, /25 de novembro de 2026/);
  const html = markup(base);
  assert.match(html, /<dt>Inscrições até<\/dt><dd><time dateTime="2026-11-09"/);
  assert.match(html, /<dt>Data do evento<\/dt><dd><time dateTime="2026-11-25"/);
});

test("neither date supplies a missing date of the other kind", () => {
  const onlyEvent = { ...base, deadline: null, deadlineLabel: "Prazo não informado" };
  assert.equal(opportunityDateSummary(onlyEvent).registration.dateTime, null);
  assert.match(markup(onlyEvent), /<dt>Inscrições<\/dt><dd>Prazo não informado/);
  assert.doesNotMatch(markup(onlyEvent), /Inscrições até/);
  const onlyRegistration = { ...base, eventStartsAt: null };
  assert.equal(opportunityDateSummary(onlyRegistration).event.dateTime, null);
  assert.match(markup(onlyRegistration), /<dt>Data do evento<\/dt><dd>Data não informada/);
  assert.equal((markup(onlyRegistration).match(/<time /g) ?? []).length, 1);
});

test("calendar days stay unchanged and confirmed times use Brasília independently", () => {
  const result = opportunityDateSummary({ ...base, deadlineAt: "2026-11-01T01:30:00Z", eventStartsAt: "2026-11-04T01:00:00Z" });
  assert.match(result.registration.text, /31 de outubro de 2026.*22:30.*Brasília/);
  assert.match(result.event.text, /3 de novembro de 2026.*22:00.*Brasília/);
  assert.equal(opportunityDateSummary(base).registration.hasTime, false);
  assert.doesNotMatch(markup(base), /00:00|Brasília/);
  const crossingYears = opportunityDateSummary({ ...base, deadline: "2026-12-31", eventStartsAt: "2027-01-05" });
  assert.match(crossingYears.registration.text, /31 de dezembro de 2026/);
  assert.match(crossingYears.event.text, /5 de janeiro de 2027/);
});

test("invalid or timezone-less values remain unknown and never crash rendering", () => {
  for (const date of ["invalid", "2026-02-30", "2026-11-25T09:00:00", "2026-11-25T25:00:00Z"]) {
    const result = opportunityDateSummary({ ...base, deadline: date, deadlineAt: date, eventStartsAt: date });
    assert.equal(result.registration.dateTime, null, date);
    assert.equal(result.event.dateTime, null, date);
    assert.doesNotMatch(markup({ ...base, deadline: date, eventStartsAt: date }), /<time /);
  }
});

test("continuous courses have no invented event while competitions show missing realization explicitly", () => {
  const course = { categories: ["formacao"], deadline: null, deadlineLabel: "Inscrições em fluxo contínuo" };
  const result = opportunityDateSummary(course);
  assert.equal(result.event, null);
  assert.equal(result.registration.text, "Em fluxo contínuo");
  assert.doesNotMatch(markup(course), /Data do evento|<time /);
  assert.match(markup({ ...course, categories: ["competicoes"] }), /Data do evento/);
});

test("detailed views distinguish unavailable times without manufacturing midnight or changing the input", () => {
  const original = structuredClone(base);
  assert.match(markup(base, { detailed: true }), /Horário de encerramento não informado/);
  assert.match(markup(base, { detailed: true }), /Horário não informado/);
  assert.deepEqual(base, original);
});

test("home and public or detailed Radar cards all expose the separate dates", () => {
  const link = { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return createElement("a", props, children); } };
  const render = opportunityLoader({ "next/link": link });
  const { EarthRadarList } = render("components/home/earth-radar/earth-radar-list.tsx");
  const { OpportunityCard } = render("components/opportunities/opportunities-board.tsx");
  const item = { ...base, id: "different-dates", title: "Evento com inscrições separadas", organization: "Organização", kind: "Programa", level: "Público diverso", location: "Brasil", verifiedAt: "2026-11-01", financials: { benefits: [], costs: [], notes: [] }, officialUrl: "https://example.com/evento", summary: "Inscrições abertas", eligibility: "Consulte as regras do evento" };
  for (const html of [
    renderToStaticMarkup(createElement(EarthRadarList, { opportunities: [item], capturedAt: "2026-11-01T12:00:00Z" })),
    renderToStaticMarkup(createElement(OpportunityCard, { opportunity: item })),
    renderToStaticMarkup(createElement(OpportunityCard, { opportunity: item, detailed: true })),
  ]) {
    assert.match(html, /Inscrições até/);
    assert.match(html, /Data do evento/);
    assert.match(html, /dateTime="2026-11-09"/);
    assert.match(html, /dateTime="2026-11-25"/);
  }
});
