import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const load = opportunityLoader();
const contract = load("lib/behavior-contract.ts");
const { shiftBehaviorDay } = load("lib/admin/behavior-insights.ts");
const [cloud, competitors] = contract.BLOG_RADAR_ARTICLES;

test("only the two public article pages receive fixed aggregate keys", () => {
  for (const article of [cloud, competitors]) {
    assert.equal(contract.blogRadarArticle(article.path), article.key);
    assert.equal(contract.blogRadarArticle("/membros" + article.path), null);
    for (const event of ["blog_radar_view", "blog_radar_click"]) {
      const valid = { page: "blog_article", event, target: article.key, device: "desktop" };
      assert.equal(contract.validBehaviorEvent(valid), true);
      assert.equal(contract.validBehaviorEvent({ ...valid, page: "home" }), false);
      assert.equal(contract.validBehaviorEvent({ ...valid, target: article.path }), false);
      assert.equal(contract.validBehaviorEvent({ ...valid, sessionId: "not-stored" }), false);
    }
  }
  assert.equal(contract.blogRadarArticle("/blog/outro-post"), null);
});

function trackerFixture(path, consent) {
  const recorded = [];
  const listeners = new Map();
  const origin = "https://www.apogee.community";
  class Element {
    constructor(href, sources) { this.href = href; this.sources = sources; }
    closest(selector) { return selector === "a[href]" || (this.sources && selector.startsWith("[data-blog-article-sources]")) ? this : null; }
  }
  const modules = {
    "next/navigation": { usePathname: () => path },
    react: { useEffect: run => run(), useState: value => [value, () => {}], useSyncExternalStore: () => consent },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@/lib/behavior-contract": contract,
    "./behavior.module.css": { default: {} },
    "./behavior-client": {
      configureBehavior() {}, flushBehavior() {}, getBehaviorSnapshot() {}, subscribeBehavior() {},
      trackBehavior: (...event) => recorded.push(event),
    },
  };
  const source = readFileSync(new URL("../components/analytics/BehaviorTracker.tsx", import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, {
    exports, require: name => modules[name], URL, Element, performance,
    window: { location: { origin }, innerHeight: 1000, setInterval() {}, addEventListener() {} },
    document: { documentElement: { scrollHeight: 1000 }, querySelectorAll: () => [], addEventListener: (name, handle) => listeners.set(name, handle) },
  });
  exports.BehaviorTracker();
  return {
    recorded,
    click(href, sources, type = "click", isTrusted = true) {
      listeners.get(type)?.({ target: new Element(href, sources), isTrusted, button: type === "auxclick" ? 1 : 0 });
    },
  };
}

test("counts one click from the article sources per measured view, preserving ordinary navigation", () => {
  const tracked = trackerFixture(cloud.path, "allow");
  tracked.click("/oportunidades", false);
  tracked.click("https://external.test/oportunidades", true);
  tracked.click("/oportunidades", true, "click", false);
  tracked.click("/oportunidades/curso", true, "auxclick");
  tracked.click("/oportunidades?busca=empreendedorismo", true);
  assert.deepEqual(tracked.recorded.filter(([event]) => event.startsWith("blog_radar_")), [
    ["blog_radar_view", cloud.key, "blog_article"], ["blog_radar_click", cloud.key, "blog_article"],
  ]);
  assert.ok(tracked.recorded.some(([event, target]) => event === "navigation" && target === "radar_list"));
  for (const state of ["deny", "ask", "refused"]) {
    const refused = trackerFixture(cloud.path, state);
    refused.click("/oportunidades", true);
    assert.deepEqual(refused.recorded, []);
  }
});

test("additive migration keeps old counts and the report reads only the selected complete days", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  for (const name of ["behavior-daily.sql", "behavior-annual-funnel.sql"]) {
    await db.exec(readFileSync(new URL("../sql/" + name, import.meta.url), "utf8"));
  }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const earlier = shiftBehaviorDay(today, -8);
  const start = shiftBehaviorDay(today, -5);
  const end = shiftBehaviorDay(today, -2);
  const insert = (day, page, event, target, count) => db.query("insert into apogee_behavior_daily values ($1,$2,$3,$4,'desktop',$5)", [day, page, event, target, count]);
  await insert(earlier, "annual_offer", "action", "annual_choose", 7);
  await assert.rejects(insert(start, "blog_article", "blog_radar_view", cloud.key, 1), { code: "23514" });
  await db.exec(readFileSync(new URL("../sql/behavior-blog-radar.sql", import.meta.url), "utf8"));
  await insert(earlier, "blog_article", "blog_radar_view", cloud.key, 8);
  await insert(start, "blog_article", "blog_radar_view", cloud.key, 4);
  await insert(end, "blog_article", "blog_radar_click", cloud.key, 1);
  await assert.rejects(insert(start, "home", "blog_radar_click", cloud.key, 1), { code: "23514" });
  await assert.rejects(insert(start, "blog_article", "blog_radar_click", "/blog/an-artigo", 1), { code: "23514" });
  assert.equal(Number((await db.query("select count from apogee_behavior_daily where page='annual_offer'")).rows[0].count), 7);

  let authorized = false;
  const sql = async (strings, ...args) => {
    assert.equal(authorized, true);
    const query = strings.map((part, index) => index ? `$${index}${part}` : part).join("");
    return (await db.query(query, args)).rows;
  };
  sql.array = values => values;
  const report = opportunityLoader({ "./access": { requireAdmin: async () => { authorized = true; } }, "@/lib/members/db": { getSql: () => sql } })("lib/admin/blog-radar.ts");
  const previous = process.env.APOGEE_BEHAVIOR_ENABLED;
  process.env.APOGEE_BEHAVIOR_ENABLED = "true";
  t.after(() => {
    if (previous === undefined) delete process.env.APOGEE_BEHAVIOR_ENABLED;
    else process.env.APOGEE_BEHAVIOR_ENABLED = previous;
  });
  assert.deepEqual(await report.getBlogRadarReport(start, end), {
    state: "ready", range: { start, end }, rows: [
      { label: cloud.label, firstDay: earlier, views: 4, clicks: 1 },
      { label: competitors.label, firstDay: null, views: null, clicks: null },
    ],
  });
  assert.equal((await report.getBlogRadarReport(start, today)).state, "invalid");
});
