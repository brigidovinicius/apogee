import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const now = new Date("2026-11-01T12:00:00Z");
const load = opportunityLoader({
  "next/navigation": { useRouter: () => ({ replace() {} }), usePathname: () => "/oportunidades", useSearchParams: () => new URLSearchParams() },
  "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
});
const logic = load("lib/opportunities/types.ts");
const { createOpportunitySearch } = load("lib/opportunities/search.ts");
const { buildOpportunityPage } = load("lib/opportunities/catalogue.ts");
const { rankOpportunities } = load("lib/opportunities/ranking.ts");
const { filterCalendarItems, readCalendarFilters, calendarFilterQuery } = load("lib/opportunities/calendar-filters.ts");
const { opportunityCardData } = load("lib/opportunities/card-data.ts");
const { OpportunitiesBoard } = load("components/opportunities/opportunities-board.tsx");
const item = (patch = {}) => ({
  id: "fixture", title: "Encontro de inovação", organization: "Instituto Exemplo", kind: "Programa", level: "Público diverso",
  categories: ["eventos"], editorialNature: "extracurricular", editorialFocus: "event_or_competition", opportunityStatus: "open",
  deadline: "2026-12-30", eventStartsAt: "2026-12-31", deadlineLabel: "30 de dezembro", verifiedAt: "2026-11-01",
  location: "São Paulo · SP", stateCode: "SP", cityName: "São Paulo", eligibility: "Público diverso",
  benefit: "Consulte a fonte", summary: "Inscrições abertas", officialUrl: "https://example.edu/evento",
  discovery: { areas: ["tecnologia"], editions: [] }, ...patch,
});
const page = (query, data = [item()], extra = {}) => buildOpportunityPage(data, new URLSearchParams({ busca: query, ...extra }), now);

for (const query of ["Encontro de inovação", "ENCONTRO DE INOVACAO", "encontro inovacao", "inovacao encontro", "  Encontro  de   inovação  ", "inovacao instituto", "inovacao sao paulo", "tecnologia", "tecnologias", "São Paulo", "SP", "tecno"]) {
  test(`finds title, combined fields and verified topics: ${query}`, () => assert.equal(page(query).total, 1));
}

test("punctuation, hyphens and name variants keep known editorial records searchable", () => {
  const batch = JSON.parse(readFileSync(new URL("../../research/tech-business-events-20261101/publication-batch.json", import.meta.url), "utf8"));
  const { toOpportunity } = load("lib/opportunities/radar-client.ts");
  const records = batch.items.map(entry => toOpportunity({ ...entry.opportunity, id: entry.id, lastCheckedAt: now.toISOString(), verifiedAt: now.toISOString() }));
  assert.ok(records.every(Boolean));
  for (const [query, id] of [
    ["Summit Convergencia", "convergencia-summit-2026"], ["Convergencia StartSe", "convergencia-summit-2026"],
    ["Red Hat Summit Connect", "red-hat-connect-sp-2026"], ["PUC SP", "pucsp-congresso-ia-2026"], ["HSM Mais", "hsm-mais-2026"],
  ]) assert.ok(page(query, records).opportunities.some(record => record.id === `radar-${id}`), query);
  for (const query of ["REC n Play", "recnplay"]) assert.equal(page(query, [item({ title: "REC’n’Play 2026" })]).total, 1);
});

test("AI, IA and full topic names are equivalent only as words or verified areas", () => {
  const data = [item({ title: "Futuro digital", discovery: { areas: ["ia"], editions: [] } })];
  for (const query of ["IA", "AI", "inteligência artificial", "artificial intelligence"]) assert.equal(page(query, data).total, 1, query);
  const art = item({ title: "Curso de fotografia", organization: "Museu", discovery: { areas: ["artes"], editions: [] } });
  assert.equal(page("ia", [art]).total, 0);
  assert.equal(page("ai", [art]).total, 0);
});

test("institution siglas and full names match without manufacturing an event's area", () => {
  assert.equal(page("USP", [item({ organization: "Universidade de São Paulo" })]).total, 1);
  assert.equal(page("universidade sao paulo", [item({ organization: "USP" })]).total, 1);
  const health = item({ title: "Congresso de saúde", organization: "Universidade de Tecnologia", discovery: { areas: ["saude"], editions: [] } });
  assert.equal(page("", [health], { area: "tecnologia" }).total, 0);
  assert.equal(page("inteligência artificial", [health]).total, 0);
});

test("institution siglas require whole words so UFSC does not match UFSCar", () => {
  const data = [item({ organization: "UFSCar" })];
  for (const query of ["UFSC", "ufsc"]) assert.equal(page(query, data).total, 0, query);
  assert.equal(page("UFSC", [item({ organization: "Universidade Federal de Santa Catarina" })]).total, 1);
});

test("uppercase ordinary words preserve prefixes, plurals and typo recovery", () => {
  for (const query of ["evento", "EVENTO", "Evento"]) assert.equal(page(query).total, 1, query);
  for (const query of ["sumit", "SUMIT", "Sumit"]) assert.equal(page(query, [item({ title: "Summit" })]).total, 1, query);
  assert.equal(page("capes", [item({ organization: "Capesul" })]).total, 0);
});

test("categories, subtypes, format and multiple themes are searchable across fields", () => {
  const data = [item({ discovery: { areas: ["ia", "negocios"], subtype: "hackathon", editions: [] }, categories: ["competicoes"], participationFormat: "online" })];
  for (const query of ["hackathon negocios", "competicoes IA", "online inovação", "ead", "a distância"]) assert.equal(page(query, data).total, 1, query);
  assert.equal(page("negocios saude", data).total, 0, "all requested themes must match");
});

test("moderate typos recover one meaningful word without rewriting years, siglas or unrelated queries", () => {
  for (const query of ["inovassao", "tecnolgia", "encontro inovassao"]) assert.equal(page(query).total, 1, query);
  const data = [item({ title: "Summit 2026 USP", organization: "Organizador" })];
  for (const query of ["2025", "USQ", "202", "SUMIT USQ", "zzzzzzzzzz"]) assert.equal(page(query, data).total, 0, query);
  assert.equal(page("tecnolgia inovassao").total, 0, "two misspelled terms cannot broaden a query");
});

test("exact names dominate mentions, benefits, nearby deadlines and repeated organization penalties", () => {
  const exact = Array.from({ length: 20 }, (_, index) => item({ id: `exact-${index}`, title: "Convergência Summit", organization: "Mesmo organizador" }));
  const incidental = Array.from({ length: 12 }, (_, index) => item({ id: `incidental-${index}`, title: "Outro evento", organization: `Outro ${index}`,
    eligibility: "Preparação para Convergência Summit", deadline: "2026-11-02", financials: { benefits: [{ label: "BOLSA", text: "Valor confirmado" }], costs: [], notes: [] } }));
  const result = page("Convergência Summit", [...incidental, ...exact]);
  assert.deepEqual(new Set(result.opportunities.slice(0, 20).map(record => record.id)), new Set(exact.map(record => record.id)));
  const ranked = rankOpportunities([...incidental, ...exact].reverse(), { ...logic.EMPTY_OPPORTUNITY_FILTERS, query: "Convergência Summit" }, now.getTime());
  assert.deepEqual(ranked.map(record => record.id), rankOpportunities([...exact, ...incidental], { ...logic.EMPTY_OPPORTUNITY_FILTERS, query: "Convergência Summit" }, now.getTime()).map(record => record.id));
});

test("textual tiers order title phrases, title words, structured fields, descriptions and typos", () => {
  const data = [
    item({ id: "exact", title: "Inovação Summit" }),
    item({ id: "phrase", title: "Inovação Summit 2026" }),
    item({ id: "title", title: "Summit de inovação" }),
    item({ id: "structured", title: "Inovação", organization: "Summit" }),
    item({ id: "description", title: "Outro evento", eligibility: "Inovação Summit" }),
    item({ id: "approximate", title: "Inovação Sumit" }),
  ];
  assert.deepEqual(page("Inovação Summit", data.reverse()).opportunities.map(record => record.id), ["exact", "phrase", "title", "structured", "description", "approximate"]);
});

test("filters remain explicit, expiry remains enforced and admissions need their category", () => {
  const data = [item(), item({ id: "rio", stateCode: "RJ", cityName: "Rio de Janeiro" }), item({ id: "expired", deadline: "2026-10-31" }),
    item({ id: "closed", opportunityStatus: "closed" }), item({ id: "course", admissionProcess: { id: "exam", title: "Ingresso" }, kind: "Curso", categories: ["formacao"] })];
  assert.deepEqual(page("inovacao", data, { uf: "SP", cidade: "São Paulo", categoria: "eventos" }).opportunities.map(record => record.id), ["fixture"]);
  assert.equal(page("inovacao", data, { categoria: "vestibular" }).total, 1);
  assert.equal(page("inovacao", data, { area: "saude" }).total, 0);
  assert.equal(page("inovacao", data, { formato: "presencial" }).total, 0);
});

test("search covers all pages with consistent counts before pagination, with no mutations or duplicates", () => {
  const data = Array.from({ length: 55 }, (_, index) => item({ id: `fixture-${index}` }));
  data.push(item({ id: "unrelated", title: "Astronomia", discovery: { areas: ["astronomia"], editions: [] } }));
  const before = structuredClone(data);
  const pages = [1, 2, 3].map(pagina => page("tecnologia", data, { pagina: String(pagina) }));
  assert.deepEqual(pages.map(result => result.opportunities.length), [24, 24, 7]);
  assert.ok(pages.every(result => result.total === 55 && result.coverage.byCategory.eventos === 55));
  assert.equal(new Set(pages.flatMap(result => result.opportunities.map(record => record.id))).size, 55);
  assert.deepEqual(data, before);
});

test("calendar shares topic/name matching but retains closed registrations and saved queries", () => {
  const record = item({ title: "Congresso de IA", opportunityStatus: "closed", deadline: "2026-10-31" });
  const params = new URLSearchParams({ busca: "inteligência artificial congresso", categoria: "eventos", periodo: "30dias" });
  assert.equal(filterCalendarItems([record], readCalendarFilters(params), now.getTime()).length, 1);
  assert.equal(page(params.get("busca"), [record]).total, 0);
  assert.equal(new URLSearchParams(calendarFilterQuery(params)).get("busca"), params.get("busca"));
});

test("blank queries preserve the feed and punctuation-only input does not return everything", () => {
  assert.equal(page("").total, 1);
  assert.equal(page("   ").total, 1);
  assert.equal(page("---").total, 0);
  assert.equal(page("<script>alert(1)</script>").total, 0);
});

test("public payloads never gain requirements, source links or cached search documents", () => {
  const privateRecord = item({ eligibility: "SECRET_REQUIREMENT", officialUrl: "https://private.example/source" });
  assert.equal(page("SECRET_REQUIREMENT", [privateRecord]).total, 1);
  const serialized = JSON.stringify(opportunityCardData(privateRecord));
  assert.doesNotMatch(serialized, /SECRET_REQUIREMENT|private\.example|SearchDocument|structured/);
  assert.equal(Object.keys(privateRecord).some(key => /search|tokens/i.test(key)), false);
});

test("empty results provide query guidance, explicit broadening and a calendar path", () => {
  const catalogue = page("nonexistentword", [item()], { categoria: "eventos", uf: "SP" });
  const html = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: [], catalogue, editorialFeed: true }));
  assert.match(html, /Buscar evento, tema ou instituição/);
  assert.match(html, /Nenhuma oportunidade encontrada para sua busca/);
  assert.match(html, /Buscar em todas as categorias e locais/);
  assert.match(html, /calendarios\/eventos\?busca=nonexistentword/);
});

test("query matcher can be used without catalogue access or environment credentials", () => {
  const search = createOpportunitySearch("inovacao instituto");
  assert.equal(search.active, true);
  assert.equal(search.score(item()), 3);
});

test("public and signed-in member pages share search while authorization precedes catalogue reads", async () => {
  const state = { signedIn: false, reads: 0 };
  const access = opportunityLoader({
    "@/lib/admin/access": { requireAdmin: async () => { throw Error("DENIED"); } },
    "@/lib/members/dal": { requireSignedInMember: async next => { if (!state.signedIn) throw Error("DENIED:" + next); return { id: "synthetic-member" }; } },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => { state.reads++; return [item({ deadline: null, eventStartsAt: null })]; } },
  })("lib/opportunities/access.ts");
  const params = new URLSearchParams({ busca: "tecnologia" });
  await assert.rejects(access.listMemberOpportunityPage(params), /DENIED:.*busca=tecnologia/);
  assert.equal(state.reads, 0);
  state.signedIn = true;
  const member = await access.listMemberOpportunityPage(params);
  const publicPage = await access.listPublicOpportunityPage(params);
  assert.deepEqual(member.opportunities, publicPage.opportunities);
  assert.equal(member.total, 1);
  assert.equal(member.opportunities[0].eligibility, "");
  assert.equal(member.opportunities[0].officialUrl, "");
});
