import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const first = { id: "radar-first", title: "Evento aberto", organization: "Instituição", kind: "Evento", level: "Público diverso",
  categories: ["eventos"], location: "Brasil", stateCode: null, cityName: null, summary: "Resumo público", benefit: "Benefício público",
  eligibility: "REQUISITO_PRIVADO", officialUrl: "https://example.test/inscricao-privada", deadline: "2099-12-31",
  deadlineLabel: "Até dezembro", verifiedAt: "2026-10-20", financials: { benefits: [], costs: ["CUSTO_PRIVADO"], notes: ["NOTA_PRIVADA"] } };
const second = { ...first, id: "radar-second" };

function fixture() {
  const state = { member: { id: "member-a", name: "Pessoa", username: "pessoa", role: "member" }, selected: null, active: false,
    claims: 0, catalogueReads: 0, authenticatedPaths: [] };
  const load = opportunityLoader({
    "@/lib/members/dal": { requireMember: async path => {
      state.authenticatedPaths.push(path);
      if (!state.member) throw Error(`LOGIN:${path}`);
      return state.member;
    } },
    "@/lib/billing/store": { radarAccess: async () => ({ active: state.active }) },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { state.catalogueReads++; return [first, second]; } },
    "./detail-store": { freeRadarOpportunity: async () => state.selected,
      claimFreeRadarOpportunity: async (_user, id) => { state.claims++; state.selected ??= id; return state.selected === id; } },
    "next/navigation": { notFound: () => { throw Error("NOT_FOUND"); }, redirect: path => { throw Error(`REDIRECT:${path}`); } },
    "@/components/members/member-bar": { MemberBar: () => null },
    "@/components/opportunities/opportunities-board": { OpportunityCard: ({ opportunity }) => React.createElement("p", null, opportunity.eligibility) },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
    "@/lib/admin/access": { requireAdmin: async () => {} },
  });
  return { state, load, detail: load("lib/opportunities/detail-access.ts").radarOpportunityDetail };
}

test("login is required before reading the source; invalid or missing details never consume the free slot", async () => {
  const { state, detail } = fixture();
  state.member = null;
  await assert.rejects(detail(first.id, true), /LOGIN:\/membros\/oportunidades\/radar-first/);
  assert.equal(state.catalogueReads, 0);
  state.member = { id: "member-a" };
  await assert.rejects(detail("unknown", true), /NOT_FOUND/);
  await assert.rejects(detail("../invalid", true), /NOT_FOUND/);
  assert.equal(state.claims, 0);
});

test("GET/prefetch does not consume or reveal a detail; explicit opening consumes exactly one distinct opportunity", async () => {
  const { state, detail } = fixture();
  assert.deepEqual((await detail(first.id)).status, "available");
  assert.equal((await detail(first.id)).opportunity, null);
  assert.equal((await detail(second.id)).status, "available");
  assert.equal(state.claims, 0);
  assert.equal((await detail(first.id, true)).opportunity.officialUrl, first.officialUrl);
  assert.equal(state.selected, first.id);
  assert.equal((await detail(first.id)).status, "free");
  assert.equal((await detail(first.id, true)).status, "free");
  assert.equal(state.claims, 1);
  assert.equal((await detail(second.id, true)).status, "purchase");
  assert.equal((await detail(second.id)).opportunity, null);
  assert.equal(state.selected, first.id);
});

test("concurrent distinct selections have one winner and the loser must purchase", async () => {
  const { state, detail } = fixture();
  const result = await Promise.all([detail(first.id, true), detail(second.id, true)]);
  assert.deepEqual(result.map(item => item.status).sort(), ["free", "purchase"]);
  assert.equal(result.filter(item => item.opportunity).length, 1);
  assert.ok([first.id, second.id].includes(state.selected));
});

test("existing access opens all details without using a free selection, including after purchase", async () => {
  const { state, detail } = fixture();
  state.active = true;
  assert.equal((await detail(first.id, true)).status, "unlimited");
  assert.equal((await detail(second.id)).opportunity.id, second.id);
  assert.equal(state.claims, 0);
  assert.equal(state.selected, null);
  state.selected = first.id;
  assert.equal((await detail(second.id)).status, "unlimited");
});

test("public/member/home card payloads exclude private fields and preserve server filters on private requirements", async () => {
  const { load } = fixture();
  const access = load("lib/opportunities/access.ts");
  const params = new URLSearchParams({ busca: "REQUISITO_PRIVADO" });
  const pages = [await access.listPublicOpportunityPage(params), await access.listMemberOpportunityPage(params)];
  const lists = [await access.listPublicOpportunities(), await access.listMemberOpportunities()];
  for (const items of [...pages.map(page => page.opportunities), ...lists]) {
    assert.equal(items.length, 2);
    const serialized = JSON.stringify(items);
    for (const secret of ["REQUISITO_PRIVADO", "inscricao-privada", "CUSTO_PRIVADO", "NOTA_PRIVADA"]) assert.ok(!serialized.includes(secret));
    assert.ok(serialized.includes(first.summary));
  }
  assert.equal(first.eligibility, "REQUISITO_PRIVADO", "source object must stay intact");
});

test("detail route and server action send a second choice to purchase and retain its destination", async () => {
  const { state, load } = fixture();
  state.selected = first.id;
  const page = load("app/membros/oportunidades/[id]/page.tsx").default;
  await assert.rejects(page({ params: Promise.resolve({ id: second.id }) }), /REDIRECT:\/membros\/radar\/acesso\?next=%2Fmembros%2Foportunidades%2Fradar-second&from=detail/);
  const { openFreeOpportunity } = load("app/membros/oportunidades/[id]/actions.ts");
  await assert.rejects(openFreeOpportunity(second.id), /REDIRECT:\/membros\/radar\/acesso/);
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: first.id }) }));
  assert.ok(html.includes(first.eligibility));
});

test("checkout return destination rejects external, unrelated, malformed and nested paths", () => {
  const { radarDetailReturnPath } = opportunityLoader()("lib/opportunities/detail-path.ts");
  const expected = "/membros/oportunidades";
  for (const input of [null, ["x"], "https://evil.test", "//evil.test", "/membros/perfil", "/membros/oportunidades/../perfil", "/membros/oportunidades/a?next=evil", "/membros/oportunidades/a/b", "/membros/oportunidades/%2f%2fevil.test"]) assert.equal(radarDetailReturnPath(input), expected);
  assert.equal(radarDetailReturnPath("/membros/oportunidades/radar-first"), "/membros/oportunidades/radar-first");
});
