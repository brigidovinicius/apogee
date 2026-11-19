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
    events: new Set(), claims: 0, catalogueReads: 0, authenticatedPaths: [], calendarEnabled: false, approved: false };
  const load = opportunityLoader({
    "@/lib/members/dal": { requireSignedInMember: async path => {
      state.authenticatedPaths.push(path);
      if (!state.member) throw Error(`LOGIN:${path}`);
      return state.member;
    } },
    "@/lib/billing/store": { radarAccess: async () => ({ active: state.active }) },
    "@/lib/members/protection": { adultAccess: async () => state.approved },
    "@/lib/opportunities/personal-calendar": { personalCalendarEnabled: () => state.calendarEnabled, savedOpportunities: async () => [] },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { state.catalogueReads++; return [first, second]; } },
    "./detail-store": {
      isFreeRadarEvent: item => item.categories.includes("eventos"),
      freeRadarState: async () => { const ids=[...new Set([...state.events,...(state.selected?[state.selected]:[])])];
        return { selected:state.selected,previousEvent:state.selected,eventIds:[...state.events],readableIds:ids,used:ids.length,remaining:Math.max(0,10-ids.length),limit:10 }; },
      claimFreeRadarEvent: async (_user,id) => { state.claims++; if(state.events.has(id))return true;if(state.events.size>=10)return false;state.events.add(id);return true; },
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
  assert.ok(state.events.has(first.id));
  assert.equal((await detail(first.id)).status, "free");
  assert.equal((await detail(first.id, true)).status, "free");
  assert.equal(state.claims, 1);
  assert.equal((await detail(second.id, true)).status, "free");
  assert.equal((await detail(second.id)).opportunity.id,second.id);
  assert.ok(state.events.has(first.id));
});

test("concurrent new events are both readable while quota remains", async () => {
  const { state, detail } = fixture();
  const result = await Promise.all([detail(first.id, true), detail(second.id, true)]);
  assert.deepEqual(result.map(item => item.status).sort(), ["free", "free"]);
  assert.equal(result.filter(item => item.opportunity).length, 2);
  assert.equal(state.events.size,2);
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

test("first navigation explains the free consultation and preserves the filtered return without consuming quota", async () => {
  const { state, load } = fixture();
  const Page = load("app/membros/oportunidades/[id]/page.tsx").default;
  const filters = { busca: "Evento", pagina: "2", token: "do-not-forward" };
  const props = { params: Promise.resolve({ id: first.id }), searchParams: Promise.resolve(filters) };
  const html = renderToStaticMarkup(await Page(props));
  assert.match(html, /Usar consulta gratuita/);
  assert.match(html, /primeira vez, você usa uma consulta/);
  assert.match(html, /href="\/membros\/oportunidades\?busca=Evento&amp;pagina=2"/);
  assert.doesNotMatch(html, /data-radar-detail-opening|REQUISITO_PRIVADO|do-not-forward/);
  assert.match(state.authenticatedPaths.at(-1), /radar-first\?busca=Evento&pagina=2$/);
  assert.equal(state.claims, 0);
  await assert.rejects(load("app/membros/oportunidades/[id]/actions.ts").openFreeOpportunity(first.id, "busca=Evento&pagina=2"), /REDIRECT:\/membros\/oportunidades\/radar-first\?busca=Evento&pagina=2$/);
  assert.equal(state.claims, 1);
  const opened = renderToStaticMarkup(await Page(props));
  assert.match(opened, /REQUISITO_PRIVADO/);
  assert.doesNotMatch(opened, /Usar consulta gratuita|Abrindo detalhes/);
});

test("a blocked detail presents the community and never starts a checkout", async () => {
  const { state, load } = fixture();
  state.selected = first.id;
  state.events = new Set([first.id,...Array.from({length:9},(_,i)=>`already-${i}`)]);
  const page = load("app/membros/oportunidades/[id]/page.tsx").default;
  const html = renderToStaticMarkup(await page({ params: Promise.resolve({ id: second.id }), searchParams: Promise.resolve({}) }));
  assert.match(html, /Ver plano com Radar completo/);
  assert.match(html, /href="\/comunidade\?next=%2Fmembros%2Foportunidades%2Fradar-second#plano-anual"/);
  assert.doesNotMatch(html, /\/api\/radar\/checkout|Abrindo checkout|method="post"|REQUISITO_PRIVADO/);
  assert.equal(state.claims, 0);
  const preserved = renderToStaticMarkup(await page({ params: Promise.resolve({ id: first.id }), searchParams: Promise.resolve({}) }));
  assert.ok(preserved.includes(first.eligibility));
});

test("a lost free-choice race shows the community without an automatic payment and keeps the opened event", async () => {
  const { state, load } = fixture();
  const Page = load("app/membros/oportunidades/[id]/page.tsx").default;
  const opening = node => {
    if (!node?.props) return null;
    if ("action" in node.props) return node;
    return [node.props.children].flat().map(opening).find(Boolean) ?? null;
  };
  const props = { params: Promise.resolve({ id: first.id }), searchParams: Promise.resolve({}) };
  const available = opening(await Page(props));
  assert.equal(typeof available.props.action, "function");
  state.selected = second.id;
  state.events = new Set([second.id,...Array.from({length:9},(_,i)=>`already-${i}`)]);
  const blocked = await Page(props);
  assert.equal(opening(blocked), null);
  assert.doesNotMatch(renderToStaticMarkup(blocked), /Abrindo checkout|\/api\/radar\/checkout/);
  state.selected = null;
  state.events.clear();
  const another = opening(await Page({ params: Promise.resolve({ id: second.id }), searchParams: Promise.resolve({}) }));
  assert.equal(typeof another.props.action, "function");
  assert.equal(state.claims, 0);
});

test("checkout return destination rejects external, unrelated, malformed and nested paths", () => {
  const { radarDetailReturnPath } = opportunityLoader()("lib/opportunities/detail-path.ts");
  const expected = "/membros/oportunidades";
  for (const input of [null, ["x"], "https://evil.test", "//evil.test", "/membros/perfil", "/membros/oportunidades/../perfil", "/membros/oportunidades/a?next=evil", "/membros/oportunidades/a/b", "/membros/oportunidades/%2f%2fevil.test"]) assert.equal(radarDetailReturnPath(input), expected);
  assert.equal(radarDetailReturnPath("/membros/oportunidades/radar-first"), "/membros/oportunidades/radar-first");
  assert.equal(radarDetailReturnPath("/membros/oportunidades/radar-first?busca=IA&token=secret&pagina=2"), "/membros/oportunidades/radar-first?busca=IA&pagina=2");
});

test("paid details open before community approval while calendar controls retain their review requirement", async () => {
  const { state, load } = fixture();
  state.active = true;
  state.calendarEnabled = true;
  const Page = load("app/membros/oportunidades/[id]/page.tsx").default;
  const props = { params: Promise.resolve({ id: first.id }), searchParams: Promise.resolve({}) };
  let html = renderToStaticMarkup(await Page(props));
  assert.match(html, /REQUISITO_PRIVADO/);
  assert.doesNotMatch(html, /Salvar no meu calendário/);
  assert.match(html, /conclua a verificação da conta/);
  state.approved = true;
  html = renderToStaticMarkup(await Page(props));
  assert.match(html, /Salvar no meu calendário/);
});

test("Ver detalhes goes straight to the protected detail while sharing retains its public URL", () => {
  const Card = opportunityLoader({
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
    "@/components/site/share-button": { ShareButton: ({ path }) => React.createElement("button", { "data-share-path": path }, "Compartilhar") },
    "./opportunity-countdown": { OpportunityCountdown: () => null },
    "./opportunity-dates": { OpportunityDates: () => null },
    "./opportunity-financials": { OpportunityBenefits: () => null, OpportunityCosts: () => null },
    "./opportunity-alert": { OpportunityAlert: () => null },
  })("components/opportunities/opportunities-board.tsx").OpportunityCard;
  const html = renderToStaticMarkup(React.createElement(Card, { opportunity: first }));
  assert.match(html, /href="\/membros\/oportunidades\/radar-first"/);
  assert.match(html, /data-share-path="\/oportunidades\/evento-aberto--radar-first"/);
  assert.doesNotMatch(html, /REQUISITO_PRIVADO|inscricao-privada/);
});
