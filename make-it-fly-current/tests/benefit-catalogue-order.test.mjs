import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const offer = (id, partner, sort_order = 0, provider_access = "included") =>
  ({ id, name: id, partner, sort_order, provider_access, last_success_at: new Date("2026-11-18T12:00:00Z") });
const offers = [
  offer("alpha", "Parceiro local"),
  offer("brand-paid", "N8N", 0, "premium"),
  offer("brand-included", " Teamwork.com "),
  offer("editorial", "Outro parceiro", 2),
];
const { orderCatalogueOffers } = opportunityLoader()("lib/benefits/catalogue-order.ts");

test("respects editorial priority, then brand and access, with stable fallback", () => {
  const tied = offer("second-local", "Parceiro B");
  const data = [...offers, tied];
  assert.deepEqual(orderCatalogueOffers(data).map(o => o.id),
    ["brand-included", "brand-paid", "alpha", "second-local", "editorial"]);
  assert.equal(data[0].id, "alpha");
  assert.equal(orderCatalogueOffers([offer("chosen", "Local", 0), offer("later", "Figma", 1)])[0].id, "chosen");
  assert.deepEqual(orderCatalogueOffers([]), []);
});

async function renderView(view, params, benefits, allowed = true) {
  const load = opportunityLoader({
    "next/link": { __esModule: true, default: "a" },
    "@/lib/benefits/store": { memberBenefitWorkspace: async () => ({
      member: {}, access: { allowed }, categories: [], benefits, history: [],
      totals: { catalogue: benefits.length, saved: 0, history: 0 },
    }) },
    "@/components/members/member-workspace": { MemberWorkspace: ({ children }) => children },
    "@/components/community/annual-access-notice": { AnnualAccessNotice: () => "Acesso anual" },
    "./benefit-card": { BenefitCard: ({ benefit }) => createElement("article", { "data-offer": benefit.id }) },
  });
  const { BenefitsWorkspace } = load("components/benefits/workspace.tsx");
  return renderToStaticMarkup(await BenefitsWorkspace({ view, params }));
}

test("default feed features its first available offer once, before the search", async () => {
  const html = await renderView("catalogue", {}, offers);
  assert.match(html, /Oferta em destaque/);
  assert.match(html, /href="#benefit-search"/);
  assert.ok(html.indexOf('data-offer="brand-included"') < html.indexOf('id="benefit-search"'));
  assert.deepEqual([...html.matchAll(/data-offer="([^"]+)"/g)].map(match => match[1]),
    ["brand-included", "brand-paid", "alpha", "editorial"]);
  assert.match(await renderView("catalogue", {}, [offers[0]]), /data-offer="alpha"/);
  const empty = await renderView("catalogue", {}, []);
  assert.match(empty, /Benefícios em preparação/);
  assert.match(empty, /Explorar a Caixa de ferramentas/);
  assert.doesNotMatch(empty + html, /perkbook|catálogo parceiro|<iframe/i);
  assert.doesNotMatch(empty, /Oferta em destaque|data-offer/);
  assert.doesNotMatch(await renderView("catalogue", {}, offers, false), /Oferta em destaque|data-offer/);
});

test("search and category show only returned matches, saved keeps its own order and history stays separate", async () => {
  for (const params of [{ q: "alpha" }, { categoria: "video" }, { publico: "startups" }]) {
    const html = await renderView("catalogue", params, [offers[0]]);
    assert.doesNotMatch(html, /Oferta em destaque|data-offer="brand/);
    assert.match(html, /data-offer="alpha"/);
  }
  const saved = await renderView("saved", {}, offers);
  assert.doesNotMatch(saved, /Oferta em destaque/);
  assert.ok(saved.indexOf('data-offer="alpha"') < saved.indexOf('data-offer="brand-paid"'));
  assert.doesNotMatch(await renderView("history", {}, []), /Oferta em destaque|data-offer/);
});
