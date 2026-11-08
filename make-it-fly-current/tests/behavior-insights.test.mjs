import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const { buildBehaviorInsights, shiftBehaviorDay } = load("lib/admin/behavior-insights.ts");
const row = (day, total, changes = {}) => ({ day, total: String(total), page: "radar_list", event: "page_view", target: "view", device: "desktop", ...changes });
const today = "2026-11-08";

test("daily calendar has thirty dates and weeks contain seven closed days across month boundaries", () => {
  const { insights } = buildBehaviorInsights(today, "2026-10-01", []);
  assert.equal(insights.daily.length, 30);
  assert.equal(insights.daily[0].day, "2026-10-10");
  assert.equal(insights.daily.at(-1).day, today);
  assert.deepEqual([insights.currentWeek.start, insights.currentWeek.end], ["2026-11-01", "2026-11-07"]);
  assert.deepEqual([insights.previousWeek.start, insights.previousWeek.end], ["2026-10-25", "2026-10-31"]);
  assert.equal(insights.currentWeek.availableDays, 7);
  assert.equal(insights.previousWeek.availableDays, 7);
});
test("calendar arithmetic crosses year and leap-day boundaries without local timezone assumptions", () => {
  assert.equal(shiftBehaviorDay("2027-01-03", -7), "2026-12-27");
  assert.equal(shiftBehaviorDay("2028-03-01", -1), "2028-02-29");
  assert.equal(shiftBehaviorDay("2027-03-01", -1), "2027-02-28");
  assert.throws(() => shiftBehaviorDay("2027-02-29", 0));
});
test("today contributes to daily and 30-day totals but never to either weekly period", () => {
  const { insights, rows } = buildBehaviorInsights(today, "2026-10-01", [row(today, 100), row("2026-11-07", 8), row("2026-10-31", 4), row("2026-11-09", 999), row("2026-10-09", 999)]);
  assert.equal(insights.totals.views, 112);
  assert.equal(insights.currentWeek.counts.views, 8);
  assert.equal(insights.previousWeek.counts.views, 4);
  assert.equal(insights.variations.views.percent, 100);
  assert.equal(rows[0].total, "112");
  assert.equal(insights.daily.at(-1).today, true);
});
test("first-day history shows missing dates separately and suppresses weekly growth", () => {
  const { insights } = buildBehaviorInsights(today, today, [row(today, 4)]);
  assert.equal(insights.daily.filter(day => day.available).length, 1);
  assert.equal(insights.daily.filter(day => !day.available).length, 29);
  assert.equal(insights.variations.views.current, null);
  assert.equal(insights.variations.views.previous, null);
  assert.equal(insights.variations.views.percent, null);
  assert.equal(insights.variations.views.reason, "history");
});
test("the first recorded day is not considered a full baseline, even with seven recorded dates", () => {
  const { insights } = buildBehaviorInsights(today, "2026-10-25", [row("2026-10-25", 2), row("2026-11-01", 4)]);
  assert.equal(insights.previousWeek.availableDays, 7);
  assert.equal(insights.previousWeek.complete, false);
  assert.equal(insights.variations.views.percent, null);
  assert.equal(insights.variations.views.difference, null);
});
test("empty collection is a true empty state and a known history can contain zero events", () => {
  const empty = buildBehaviorInsights(today, null, []).insights;
  assert.equal(empty.daily.every(day => !day.available), true);
  assert.equal(empty.variations.actions.reason, "history");
  const known = buildBehaviorInsights(today, "2026-10-01", []).insights;
  assert.equal(known.daily.every(day => day.available), true);
  assert.equal(known.variations.actions.reason, "no-events");
  assert.equal(known.variations.actions.percent, null);
});
test("zero baseline reports absolute change without an invented percent or infinity", () => {
  const { insights } = buildBehaviorInsights(today, "2026-10-01", [row("2026-11-07", 5)]);
  assert.deepEqual(insights.variations.views, { current: 5, previous: 0, difference: 5, percent: null, reason: "zero-base" });
});
test("negative, flat and rounded changes retain their sign and never render negative zero", () => {
  assert.equal(buildBehaviorInsights(today, "2026-10-01", [row("2026-10-31", 8), row("2026-11-07", 4)]).insights.variations.views.percent, -50);
  assert.equal(buildBehaviorInsights(today, "2026-10-01", [row("2026-10-31", 8)]).insights.variations.views.percent, -100);
  assert.equal(buildBehaviorInsights(today, "2026-10-01", [row("2026-10-31", 3), row("2026-11-07", 4)]).insights.variations.views.percent, 33.3);
  const tiny = buildBehaviorInsights(today, "2026-10-01", [row("2026-10-31", 10000), row("2026-11-07", 9999)]).insights.variations.views.percent;
  assert.equal(Object.is(tiny, -0), false);
});
test("daily metrics combine categories, targets and devices while the existing detail table is preserved", () => {
  const model = buildBehaviorInsights(today, "2026-10-01", [row(today, 2), row(today, 3, { device: "mobile" }), row(today, 4, { page: "store", event: "action", target: "store_interest" }), row(today, 6, { event: "scroll_depth", target: "50" })]);
  assert.deepEqual(model.insights.daily.at(-1).counts, { views: 5, navigation: 0, actions: 4, filters: 0 });
  assert.equal(model.rows.length, 4);
  assert.equal(model.rows.some(row => row.event === "scroll_depth"), true);
  assert.doesNotMatch(JSON.stringify(model.insights), /email|phone|session|userId|search|token|radar_list|store_interest/);
});
test("invalid data cannot turn a database failure into fake zero or imprecise counters", () => {
  for (const bad of ["NaN", "-1", "1.5", "9007199254740992"]) assert.throws(() => buildBehaviorInsights(today, "2026-10-01", [row(today, bad)]));
  assert.throws(() => buildBehaviorInsights(today, null, [row(today, 1)]));
  assert.throws(() => buildBehaviorInsights(today, "2026-11-09", []));
});

async function withEnabled(value, run) {
  const previous = process.env.APOGEE_BEHAVIOR_ENABLED;
  process.env.APOGEE_BEHAVIOR_ENABLED = value;
  try { await run(); } finally { if (previous === undefined) delete process.env.APOGEE_BEHAVIOR_ENABLED; else process.env.APOGEE_BEHAVIOR_ENABLED = previous; }
}
test("DAL authorizes first and fetches only existing aggregate columns in one snapshot", () => withEnabled("true", async () => {
  let authorized = false, calls = 0;
  const sql = async strings => {
    assert.equal(authorized, true); calls++;
    const query = strings.join("?");
    assert.match(query, /America\/Sao_Paulo/);
    assert.match(query, /between reference.today - 29 and reference.today/);
    assert.doesNotMatch(query, /select\s+\*|\buser\b|\bsession\b|\bemail\b|join/i);
    return [{ today, first_day: "2026-10-01", records: [row(today, 4)] }];
  };
  const dal = opportunityLoader({ "./access": { requireAdmin: async () => { authorized = true; } }, "@/lib/members/db": { getSql: () => sql } })("lib/admin/behavior.ts");
  const result = await dal.getBehaviorOverview();
  assert.equal(result.state, "ready"); assert.equal(calls, 1); assert.equal(result.insights.totals.views, 4);
}));
test("disabled collection and unavailable database do not produce a fabricated chart", () => withEnabled("false", async () => {
  let queries = 0;
  const dal = opportunityLoader({ "./access": { requireAdmin: async () => {} }, "@/lib/members/db": { getSql() { queries++; throw Error("private database detail"); } } })("lib/admin/behavior.ts");
  assert.equal((await dal.getBehaviorOverview()).state, "disabled"); assert.equal(queries, 0);
  process.env.APOGEE_BEHAVIOR_ENABLED = "true";
  const unavailable = await dal.getBehaviorOverview();
  assert.deepEqual(unavailable, { state: "unavailable", rows: [] });
}));
test("chart renders its accessible daily table, explicit periods and a partial-history notice", () => {
  const { BehaviorInsightsPanel } = load("components/admin/behavior-insights.tsx");
  const html = renderToStaticMarkup(createElement(BehaviorInsightsPanel, { data: buildBehaviorInsights(today, today, [row(today, 4)]).insights }));
  assert.match(html, /Evolução diária/); assert.match(html, /Semana contra semana/);
  assert.match(html, /01\/11 a 07\/11/); assert.match(html, /25\/10 a 31\/10/);
  assert.match(html, /Hoje é parcial/); assert.match(html, /Hoje fica de fora/);
  assert.match(html, /Histórico incompleto/); assert.doesNotMatch(html, /Infinity|NaN|\+100%/);
  assert.match(html, /Explorar dia/); assert.match(html, /Ver valores por dia/); assert.match(html, /aria-pressed="true"/);
});
