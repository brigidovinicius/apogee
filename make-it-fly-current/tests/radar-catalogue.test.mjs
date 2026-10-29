import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
let query = "";
const load = opportunityLoader({
  "next/navigation": { useRouter: () => ({ replace() {} }), usePathname: () => "/oportunidades", useSearchParams: () => new URLSearchParams(query) },
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
});
const { buildOpportunityPage } = load("lib/opportunities/catalogue.ts");
const { rankOpportunities, DEFAULT_RANKING } = load("lib/opportunities/ranking.ts");
const logic = load("lib/opportunities/types.ts");
const radar = load("lib/opportunities/radar-client.ts");
const { OpportunitiesBoard } = load("components/opportunities/opportunities-board.tsx");
const now = new Date("2026-10-16T15:00:00Z");
const item = (id, patch = {}) => ({ id, title: id, organization: "Universidade", kind: "Programa", level: "Ensino médio",
  categories: ["eventos"], editorialNature: "extracurricular", editorialFocus: "event_or_competition", opportunityStatus: "open",
  deadline: "2026-10-30", deadlineLabel: "Até 30 de outubro", verifiedAt: "2026-10-16", summary: "Inscrições abertas",
  eligibility: "Equipes de estudantes", benefit: "Participação gratuita", officialUrl: "https://example.edu/edital", location: "Gaspar · SC", stateCode: "SC", cityName: "Gaspar", ...patch });
const exam = (id, patch = {}) => item(id, { kind: "Curso", categories: ["formacao"], editorialNature: "formal_admission", editorialFocus: null,
  admissionProcess: { id: "ifsc", title: "IFSC — Ingresso 2027.1" }, ...patch });
const dataset = [exam("Química"), exam("Informática"), exam("Administração", { cityName: "Joinville" }),
  item("Hackathon"), item("Conferência", { categories: ["eventos", "pesquisa"] }),
  item("Curso livre", { kind: "Curso", categories: ["formacao"], editorialNature: "unclassified", editorialFocus: null })];
const page = (query = "", data = dataset) => buildOpportunityPage(data, new URLSearchParams(query), now);
const html = catalogue => renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: catalogue.opportunities, catalogue, editorialFeed: true })).replace(/<!--.*?-->/g, "");

test("A/C: default, Todas, search, geography and education never opt into vestibular; removing it restores feed", () => {
  for (const params of ["", "categoria=Todas", "busca=Quimica", "uf=SC&cidade=Gaspar", "formacao=Ensino+médio", "modalidade=Curso", "categoria=formacao"]) {
    const result = page(params);
    assert.equal(result.opportunities.some(logic.isEntranceExamOpportunity), false, params);
    assert.doesNotMatch(html(result), /<h3>IFSC/);
  }
  assert.equal(page().total, 3);
  assert.equal(page("categoria=vestibular").total, 1);
  assert.deepEqual(page().opportunities.map(i => i.id), ["Conferência", "Hackathon", "Curso livre"]);
  assert.equal(dataset.length, 6);
});

test("B/D: one process, compact preview, complete source details and counts after SC/Gaspar/course filters", () => {
  const result = page("categoria=vestibular&uf=SC&cidade=Gaspar");
  assert.equal(result.total, 1);
  assert.deepEqual(result.opportunities.map(i => i.id), ["Informática", "Química"]);
  const output = html(result);
  assert.equal((output.match(/<article /g) ?? []).length, 1);
  assert.match(output, /2 opções de curso correspondem/);
  assert.match(output, /Ver cursos/);
  assert.doesNotMatch(output, /Equipes de estudantes/);
  assert.match(output, /<details/);
  assert.equal(page("categoria=vestibular&uf=SC&cidade=Gaspar&busca=quimica").opportunities.length, 1);
  assert.equal(page("categoria=vestibular&uf=SC&cidade=Gaspar").coverage.byCategory.eventos, 2);
});

test("national eligibility preserves null addresses and combines with exam selection", () => {
  const national = exam("Nacional", { nationallyEligible: true, stateCode: null, cityName: null, location: "Brasil", admissionProcess: { id: "national", title: "Processo nacional" } });
  const result = page("categoria=vestibular&uf=SC&cidade=Gaspar", [...dataset, national]);
  assert.equal(result.total, 2);
  assert.equal(result.opportunities.find(i => i.id === "Nacional").location, "Brasil");
  assert.equal(page("uf=SC&cidade=Gaspar", [...dataset, national]).opportunities.some(logic.isEntranceExamOpportunity), false);
});

test("pagination groups before slicing, limits serialized records, clamps pages and never duplicates entries", () => {
  const data = Array.from({ length: 60 }, (_, i) => item(`event-${String(i).padStart(2, "0")}`, { organization: `Organizador ${i % 6}` }));
  const pages = [1, 2, 3].map(i => page(`pagina=${i}`, data));
  assert.deepEqual(pages.map(p => p.opportunities.length), [24, 24, 12]);
  assert.equal(new Set(pages.flatMap(p => p.opportunities.map(i => i.id))).size, 60);
  for (const p of pages) assert.equal(p.total, 60);
  for (const value of ["-1", "NaN", "1.5", "Infinity"]) assert.equal(page(`pagina=${value}`, data).page, 1);
  assert.equal(page("pagina=999", data).page, 3);
  query = "pagina=2&busca=event";
  try { assert.match(html(pages[1]), /pagina=3/); assert.match(html(pages[1]), /Página 2 de 3/); } finally { query = ""; }
  const courses = Array.from({ length: 59 }, (_, i) => exam(`curso-${i}`));
  assert.equal(page("categoria=vestibular", courses).total, 1);
});

test("ranking diversifies organizations within nature tiers and cash never promotes formal admissions", () => {
  const events = Array.from({ length: 20 }, (_, i) => item(`event-${i}`, { organization: i < 16 ? "Dominante" : `Organizador ${i}` }));
  const formal = exam("rich", { financials: { benefits: [{ label: "BOLSA", text: "R$ 100.000,00" }], costs: [], notes: [] } });
  const ordered = rankOpportunities([formal, ...events], logic.EMPTY_OPPORTUNITY_FILTERS, now.getTime());
  assert.equal(ordered.at(-1).id, "rich");
  assert.ok(new Set(ordered.slice(0, 6).map(i => i.organization)).size >= 4);
  assert.deepEqual(rankOpportunities([...events].reverse(), logic.EMPTY_OPPORTUNITY_FILTERS, now.getTime()).map(i => i.id), ordered.slice(0, -1).map(i => i.id));
  assert.equal(Object.isFrozen(DEFAULT_RANKING), true);
});

test("entrance classification handles real punctuated rules, preserves workshops and negative statements", () => {
  for (const requirementsText of ["Curso; seleção por prova:. Oferta: 40 vagas.", "Ingresso na graduação por vestibular.", "Exige aprovação no vestibular."]) assert.equal(radar.entranceExamFromRadar({ isCourse: true, requirementsText }), true);
  for (const requirementsText of ["Não exige aprovação no vestibular.", "Orientação sobre ingresso por vestibular.", "Workshop para estudantes de mestrado."]) assert.equal(radar.entranceExamFromRadar({ requirementsText }), false);
  assert.equal(radar.normalizePublicText("Seleção por prova:.  Oferta: 40 vagas.."), "Seleção por prova. Oferta: 40 vagas.");
});

test("precision of deadlines and unknown event starts remain distinct without changing countdown", () => {
  assert.equal(page("", [item("today", { deadline: "2026-10-16" }), item("expired", { deadline: "2026-10-15" })]).total, 1);
  assert.equal(logic.isOpportunityOpen(item("exact", { deadlineAt: "2026-10-16T14:59:59Z" }), "2026-10-16", now.getTime()), false);
});

test("combined financial, modality, national and deadline filters use confirmed facts and URL round-trip", () => {
  const data = [item("paid", { participationFormat: "online", nationallyEligible: true, stateCode: null, cityName: null,
    financials: { benefits: [{ label: "PREMIAÇÃO", text: "R$ 2.500,00" }], costs: ["Inscrição gratuita."], notes: [] } }),
    item("unpaid", { explicitlyUnpaid: true }), item("unknown")];
  assert.deepEqual(page("formato=online&abrangencia=nacional&beneficio=premiacao&prazo=30dias", data).opportunities.map(i => i.id), ["paid"]);
  assert.deepEqual(page("beneficio=nao-remunerado", data).opportunities.map(i => i.id), ["unpaid"]);
  assert.deepEqual(page("beneficio=gratuito", data).opportunities.map(i => i.id), ["paid"]);
  assert.equal(page("prazo=7dias", data).total, 0);
  const params = new URLSearchParams("formato=online&abrangencia=nacional&beneficio=premiacao&prazo=30dias");
  const filters = logic.opportunityFiltersFromSearchParams(params);
  assert.equal(logic.countActiveOpportunityFilters(filters), 4);
  assert.deepEqual(logic.opportunityFiltersFromSearchParams(logic.setOpportunityFilterSearchParams(new URLSearchParams(), filters)), filters);
  assert.equal(radar.participationFormatFromRadar({ requirementsText: "Inscrição online pelo site. Comparecer ao câmpus." }), null);
  assert.equal(radar.participationFormatFromRadar({ requirementsText: "Modalidade presencial; dedicação de 48 horas." }), "presencial");
  assert.equal(radar.participationFormatFromRadar({ requirementsText: "Modalidade online. Modalidade presencial." }), null);
});

test("management retains admission course access within formação; injected clock controls exact expiration", () => {
  assert.equal(logic.filterOpportunities(dataset, { ...logic.EMPTY_OPPORTUNITY_FILTERS, category: "formacao" }, "2026-10-16", true, true, now.getTime()).length, 4);
  const exact = item("exact", { deadlineAt: "2026-10-16T15:00:01Z" });
  assert.equal(page("", [exact]).total, 1);
  assert.equal(buildOpportunityPage([exact], new URLSearchParams(), new Date("2026-10-16T15:00:02Z")).total, 0);
});

test("management keeps closed calendar records editable with matching counts and filter options", () => {
  const closed = item("Prova futura", { opportunityStatus: "closed", deadline: null, deadlineUnknown: true,
    categories: ["competicoes"], level: "Pós-graduação", kind: "Programa" });
  const result = item("Resultado futuro", { opportunityStatus: "result_published", deadline: null,
    categories: ["competicoes"], level: "Pós-graduação", kind: "Programa" });
  const data = [closed, result];
  assert.equal(page("", data).total, 0, "public registration feed remains unchanged");
  query = "categoria=competicoes&formacao=Pós-graduação&busca=Prova";
  try {
    const output = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: data, management: true })).replace(/<!--.*?-->/g, "");
    assert.match(output, /Prova futura/);
    assert.doesNotMatch(output, /Resultado futuro/);
    assert.match(output, /Editar ou excluir/);
    assert.match(output, /1 oportunidade visível/);
    assert.match(output, /aria-label="Formação: Pós-graduação" aria-pressed="true"/);
    assert.match(output, /Competições e hackathons.*?\(1\)/s);
  } finally { query = ""; }
});


test("bucket ranking matches the exhaustive greedy reference on mixed organizations, categories and scores", () => {
  const data = Array.from({ length: 80 }, (_, i) => item(`candidate-${i}`, { organization: `Organization ${i % 9}`,
    categories: [i % 3 ? "eventos" : "competicoes"], deadline: `2026-10-${String(17 + i % 12).padStart(2, "0")}`,
    financials: { benefits: i % 5 ? [] : [{ label: "BOLSA", text: "Valor confirmado" }], costs: [], notes: [] } }));
  const { opportunityScore } = load("lib/opportunities/ranking.ts");
  const orgs = new Map(), categories = new Map(), pool = [...data], expected = [];
  const score = item => opportunityScore(item, logic.EMPTY_OPPORTUNITY_FILTERS, now.getTime()) - Math.min(40, (orgs.get(item.organization.toLowerCase()) ?? 0) * 4) - Math.min(12, categories.get(logic.primaryOpportunityCategory(item)) ?? 0);
  while (pool.length) {
    pool.sort((a, b) => score(b) - score(a) || a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id));
    const best = pool.shift(); expected.push(best.id);
    const org = best.organization.toLowerCase(), category = logic.primaryOpportunityCategory(best);
    orgs.set(org, (orgs.get(org) ?? 0) + 1); categories.set(category, (categories.get(category) ?? 0) + 1);
  }
  assert.deepEqual(rankOpportunities(data, logic.EMPTY_OPPORTUNITY_FILTERS, now.getTime()).map(i => i.id), expected);
});
