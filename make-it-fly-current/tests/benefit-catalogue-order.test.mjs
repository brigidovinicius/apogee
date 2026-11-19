import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
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

async function renderView(view, params, benefits, allowed = true, toolbox = true) {
  const load = opportunityLoader({
    "next/link": { __esModule: true, default: "a" },
    "@/lib/members/resource-availability": { memberResourceAvailability: async () => ({ ferramentas: toolbox, trilha: false }) },
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

test("default feed starts with search and features its best available offers exactly once", async () => {
  const html = await renderView("catalogue", {}, offers);
  assert.match(html, /Ofertas em destaque/);
  assert.ok(html.indexOf('id="benefit-search"') < html.indexOf('data-offer="brand-included"'));
  assert.deepEqual([...html.matchAll(/data-offer="([^"]+)"/g)].map(match => match[1]),
    ["brand-included", "brand-paid", "alpha", "editorial"]);
  assert.match(await renderView("catalogue", {}, [offers[0]]), /data-offer="alpha"/);
  const empty = await renderView("catalogue", {}, []);
  assert.match(empty, /Benefícios em preparação/);
  assert.match(empty, /href="\/membros\/ferramentas"/);
  assert.doesNotMatch(await renderView("catalogue", {}, [], true, false), /href="\/membros\/ferramentas"/);
  assert.doesNotMatch(empty + html, /perkbook|catálogo parceiro|<iframe/i);
  assert.doesNotMatch(empty, /Ofertas em destaque|data-offer/);
  assert.doesNotMatch(await renderView("catalogue", {}, offers, false), /Ofertas em destaque|data-offer/);
});

test("curated campaigns rise above ordinary catalogue order and the exact approved Rosa URL comes first", () => {
  const figma = offer("figma-education", "Figma", 13);
  const rosa = { ...offer("hostgator-rosa", "HostGator Brasil", 9), redemption_url: "https://www.hostgator.com.br/53289-77-3-32.html" };
  const generic = { ...offer("generic-hostgator", "HostGator", 8), redemption_url: "https://www.hostgator.com.br/" };
  assert.deepEqual(orderCatalogueOffers([generic, figma, rosa]).map(item => item.id), [rosa.id, figma.id, generic.id]);
});

test("all configured partners have a local brand image with HTTPS provenance", () => {
  const offers = JSON.parse(readFileSync(new URL("../content/benefit-offers.json", import.meta.url), "utf8"));
  const { benefitBrand } = opportunityLoader()("lib/benefits/brands.ts");
  for (const partner of new Set([...offers.map(item => item.partner), "Teamwork.com", "HostGator Brasil", "Samsung Brasil e Google"])) {
    const brand = benefitBrand(partner);
    assert.ok(brand, partner);
    assert.equal(new URL(brand.source).protocol, "https:", partner);
    assert.ok(existsSync(new URL("../public" + brand.image, import.meta.url)), partner);
  }
});

test("search and category show only returned matches, saved keeps its own order and history stays separate", async () => {
  for (const params of [{ q: "alpha" }, { categoria: "video" }, { publico: "startups" }]) {
    const html = await renderView("catalogue", params, [offers[0]]);
    assert.doesNotMatch(html, /Ofertas em destaque|data-offer="brand/);
    assert.match(html, /data-offer="alpha"/);
  }
  const saved = await renderView("saved", {}, offers);
  assert.doesNotMatch(saved, /Ofertas em destaque/);
  assert.ok(saved.indexOf('data-offer="alpha"') < saved.indexOf('data-offer="brand-paid"'));
  assert.doesNotMatch(await renderView("history", {}, []), /Ofertas em destaque|data-offer/);
});
