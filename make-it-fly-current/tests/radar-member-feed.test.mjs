import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

let query = "";
const load = opportunityLoader({
  "next/navigation": { useRouter: () => ({ replace() {} }), usePathname: () => "/membros/oportunidades", useSearchParams: () => new URLSearchParams(query) },
  "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
});
const radar = load("lib/opportunities/radar-client.ts");
const logic = load("lib/opportunities/types.ts");
const { orderMemberFeed } = load("lib/opportunities/member-feed.ts");
const { groupAdmissionProcesses } = load("lib/opportunities/admission-processes.ts");
const { OpportunityBenefits, OpportunityCosts } = load("components/opportunities/opportunity-financials.tsx");
const { OpportunitiesBoard } = load("components/opportunities/opportunities-board.tsx");
const money = load("lib/opportunities/money.ts");

const source = (patch = {}) => ({
  id: "one", title: "Hackathon universitário", institution: "Universidade",
  officialUrl: "https://example.edu/edital", lastCheckedAt: "2026-10-15T12:00:00Z",
  applicantType: "mixed", benefitType: "other", categories: ["competicoes"],
  amountText: "Condições na fonte oficial.", requirementsText: "Equipes de até 5 estudantes; modalidade presencial; dedicação de 48 horas.",
  deadlineAt: "2099-10-30", deadlinePrecision: "date_only", opportunityStatus: "open", ...patch,
});
const opportunity = (patch = {}) => {
  const result = radar.toOpportunity(source(patch));
  assert.ok(result);
  return result;
};
const markup = (item) => renderToStaticMarkup(React.createElement("article", null,
  React.createElement(OpportunityBenefits, { opportunity: item }),
  React.createElement("dl", null, React.createElement(OpportunityCosts, { opportunity: item })),
)).replace(/<!--.*?-->/g, "");
const plain = (html) => html.replace(/<[^>]*>/g, "");

for (const [name, patch, expected] of [
  ["hackathon with cash prize and free registration", { benefitType: "prize", amountText: "Premiação de R$ 10000 para a equipe vencedora. Inscrição gratuita." }, ["PREMIAÇÃO", "R$ 10.000,00", "equipe vencedora", "Inscrição gratuita"]],
  ["hackathon with cash prize and paid registration", { benefitType: "prize", amountText: "Premiação: R$ 5000. Inscrição: R$ 149,90." }, ["PREMIAÇÃO", "R$ 5.000,00", "R$ 149,90"]],
  ["paid event without remuneration", { categories: ["eventos"], amountText: "Ingresso a partir de R$ 79,90." }, ["Participação", "R$ 79,90"]],
  ["extracurricular monthly project", { categories: ["pesquisa"], benefitType: "research_scholarship", amountText: "Bolsa de R$ 2000 / mês." }, ["BOLSA", "R$ 2.000,00", "/ mês"]],
  ["confirmed salary without an amount", { categories: ["carreira"], amountText: "Remunerado" }, ["REMUNERAÇÃO", "Remunerado · Valor não divulgado"]],
  ["cash prize without an amount", { benefitType: "prize", amountText: "Premiação em dinheiro confirmada" }, ["PREMIAÇÃO", "Valor não divulgado"]],
  ["total prize distributed among teams", { benefitType: "prize", amountText: "R$ 50000 em premiação total, distribuída entre as equipes vencedoras." }, ["PREMIAÇÃO TOTAL", "R$ 50.000,00", "distribuída entre as equipes"]],
  ["maximum remuneration", { amountText: "Remuneração de até R$ 5000 por projeto." }, ["REMUNERAÇÃO", "até R$ 5.000,00", "por projeto"]],
  ["salary range", { benefitType: "internship", amountText: "Bolsa-auxílio de R$ 2200 a R$ 2800, conforme vaga." }, ["R$ 2.200,00 a R$ 2.800,00", "conforme vaga"]],
  ["foreign currency", { amountText: "Remuneração: USD 2,500.50 por projeto." }, ["USD 2,500.50", "por projeto"]],
]) test(name, () => {
  const item = opportunity(patch);
  const html = markup(item), text = plain(html);
  for (const fragment of expected) assert.ok(text.includes(fragment), `${fragment}: ${text}`);
  if (item.financials.benefits.length && /R\$|USD/.test(patch.amountText)) assert.match(html, /<strong>(?:R\$|USD) /);
  if (item.financials.costs.length) assert.doesNotMatch(html, /<strong>R\$ (?:149,90|79,90)<\/strong>/);
  if (name.startsWith("paid event")) { assert.equal(item.financials.benefits.length, 0); assert.doesNotMatch(html, /<strong>/); }
});

test("unknown, negated, non-cash and mixed legacy statements never become remuneration", () => {
  for (const amountText of [
    "Premiação em produtos no valor de R$ 5000.", "Desconto de R$ 5000 na mensalidade.",
    "Reembolso de R$ 500 de transporte.", "Premiação financeira não comprovada.",
    "Remuneração não confirmada: R$ 2000.", "Apoio financeiro não informado.",
    "Não haverá premiação em dinheiro de R$ 5000.", "Remuneração não é oferecida: R$ 5000.",
    "Premiação de R$ 5000 a confirmar.",
    "Ingresso de R$ 200 com premiação de R$ 5000 e condições não separadas.",
    "Premiação em produtos e dinheiro, distribuição não informada.",
  ]) {
    const item = opportunity({ benefitType: "prize", amountText });
    assert.equal(item.financials.benefits.length, 0, amountText);
    assert.doesNotMatch(markup(item), /<strong>/);
    assert.ok(plain(markup(item)).length > 0);
  }
  const free = opportunity({ amountText: "Inscrição gratuita." });
  assert.equal(free.financials.benefits.length, 0);
  assert.doesNotMatch(markup(free), /R\$ 0,00/);
});

test("source stipend confirms payment without inventing value, currency or periodicity", () => {
  const item = opportunity({ benefitType: "extension_scholarship", amountText: "Consulte o valor na fonte oficial." });
  assert.deepEqual(item.financials.benefits, [{ label: "BOLSA", text: "Bolsa · Valor não divulgado" }]);
  assert.ok(plain(markup(item)).includes("Consulte o valor na fonte oficial."));
  assert.equal(opportunity({ benefitType: "academic_scholarship", amountText: "Desconto de 50% na mensalidade." }).financials.benefits.length, 0);
});

test("money formatter keeps conditions, decimal cents, long values and currencies", () => {
  for (const [value, expected] of [[500, "R$ 500,00"], [2000, "R$ 2.000,00"], [10500.5, "R$ 10.500,50"]]) assert.equal(money.formatMoney(value), expected);
  assert.equal(money.formatMoneyText("Até R$ 10500,50 / mês."), "Até R$ 10.500,50 / mês.");
  assert.equal(money.formatMoneyText("De R$ 2000 a 3500 por projeto."), "De R$ 2.000,00 a R$ 3.500,00 por projeto.");
  assert.equal(money.formatMoneyText("USD 2,500.50; € 2.000,00"), "USD 2,500.50; € 2.000,00");
  assert.equal(money.formatMoneyText("R$ 2.50 ambíguo"), "R$ 2.50 ambíguo");
  assert.equal(money.formatMoneyText("R$ 2800, conforme vaga."), "R$ 2.800,00, conforme vaga.");
  assert.equal(money.formatMoneyText("R$ 2200 a 2800, conforme vaga."), "R$ 2.200,00 a R$ 2.800,00, conforme vaga.");
  assert.equal(money.formatMoneyText("R$ 10,555 ambíguo"), "R$ 10,555 ambíguo");
});

test("nature uses structured categories and contextual admission rules rather than institution or audience", () => {
  assert.equal(opportunity().editorialNature, "extracurricular");
  assert.equal(opportunity({ title: "Evento para estudantes de mestrado", applicantType: "postgraduate_student", categories: ["eventos"] }).editorialNature, "extracurricular");
  assert.equal(opportunity({ title: "Competição da Faculdade de Engenharia" }).editorialNature, "extracurricular");
  for (const degree of ["mestrado", "doutorado"]) {
    assert.equal(opportunity({ title: `Seleção de ${degree} 2027`, categories: ["formacao"], isCourse: true }).editorialNature, "formal_admission");
    assert.equal(opportunity({ title: `${degree} em Física`, categories: ["formacao"], isCourse: true, requirementsText: "Inscrições abertas para ingresso no curso." }).editorialNature, "formal_admission");
  }
  assert.equal(opportunity({ isCourse: true, categories: ["formacao"], admissionProcess: { id: "exam", title: "Ingresso por vestibular" } }).editorialNature, "formal_admission");
  assert.equal(opportunity({ title: "Engenharia", isCourse: true, categories: ["formacao"], requirementsText: "Ingresso na graduação por vestibular." }).editorialNature, "formal_admission");
  assert.equal(opportunity({ title: "Bolsa para doutorandos", categories: ["pesquisa"] }).editorialNature, "extracurricular");
  assert.equal(opportunity({ categories: ["formacao"], isCourse: true }).editorialNature, "unclassified");
});

test("whole catalogue is ordered before pagination, cash cannot elevate formal admission, filters stay specific", () => {
  const academic = opportunity({ id: "academic", title: "Seleção de doutorado", isCourse: true, categories: ["formacao"], benefitType: "research_scholarship", amountText: "Bolsa de R$ 100000.", deadlineAt: "2099-01-01" });
  const events = Array.from({ length: 50 }, (_, i) => opportunity({ id: `event-${String(i).padStart(2, "0")}` }));
  const paid = opportunity({ id: "paid", benefitType: "prize", amountText: "Premiação de R$ 500." });
  const original = [academic, ...events.toReversed(), paid];
  const ordered = orderMemberFeed(original, logic.EMPTY_OPPORTUNITY_FILTERS);
  assert.equal(ordered[0].id, paid.id);
  assert.equal(ordered.at(-1).id, academic.id);
  assert.deepEqual(orderMemberFeed(original.toReversed(), logic.EMPTY_OPPORTUNITY_FILTERS).map(i => i.id), ordered.map(i => i.id));
  const entries = groupAdmissionProcesses(ordered).entries;
  const pages = [entries.slice(0, 24), entries.slice(24, 48), entries.slice(48)];
  assert.equal(new Set(pages.flat().map(i => i.id)).size, original.length);
  assert.equal(pages.flat().length, original.length);
  assert.equal(original[0], academic);
  const filters = { ...logic.EMPTY_OPPORTUNITY_FILTERS, query: "doutorado" };
  assert.deepEqual(logic.filterOpportunities(orderMemberFeed(original, filters), filters, "2099-01-01", true).map(i => i.id), [academic.id]);
  const category = { ...logic.EMPTY_OPPORTUNITY_FILTERS, category: "formacao" };
  assert.deepEqual(logic.filterOpportunities(orderMemberFeed(original, category), category, "2099-01-01", true).map(i => i.id), [academic.id]);
  assert.equal(orderMemberFeed(original, category)[0], academic);
});

test("expired dates, elapsed exact deadlines and elapsed events with unknown deadline are excluded", () => {
  const now = Date.parse("2026-10-15T15:00:00Z");
  assert.equal(logic.isOpportunityOpen(opportunity({ deadlineAt: "2026-10-14" }), "2026-10-15", now), false);
  assert.equal(logic.isOpportunityOpen(opportunity({ deadlineAt: "2026-10-15T14:59:59Z", deadlinePrecision: "exact_datetime" }), "2026-10-15", now), false);
  assert.equal(logic.isOpportunityOpen(opportunity({ deadlineAt: "2026-10-15T15:00:01Z", deadlinePrecision: "exact_datetime" }), "2026-10-15", now), true);
  assert.equal(logic.isOpportunityOpen(opportunity({ deadlineAt: null, deadlinePrecision: "not_informed", categories: ["eventos"], eventStartsAt: "2026-10-15T14:59:59Z" }), "2026-10-15", now), false);
});

test("member board renders extracurriculars first, a shared 24-card page, distinct dates and intact requirements", () => {
  const exams = ["a", "b"].map(id => opportunity({ id, title: `Curso ${id}`, isCourse: true, categories: ["formacao"], admissionProcess: { id: "exam", title: "Vestibular agrupado" } }));
  const event = opportunity({ id: "event", title: "Encontro universitário", categories: ["eventos"], eventStartsAt: "2099-10-28", amountText: "Ingresso: R$ 79,90." });
  const ordered = orderMemberFeed([...exams, event], logic.EMPTY_OPPORTUNITY_FILTERS);
  const html = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: ordered, memberFeed: true }));
  assert.ok(html.includes(event.title));
  assert.doesNotMatch(html, /Vestibular agrupado/);
  assert.ok(html.includes(event.eligibility));
  assert.match(html, /Realização/); assert.match(html, /Janela de inscrição/); assert.match(html, /Início do evento/);
  assert.match(html, /<time dateTime="2099-10-28"/);
  const lots = orderMemberFeed([...exams, ...Array.from({ length: 25 }, (_, i) => ({ ...event, id: `event-${i}`, title: `Encontro ${i}` }))], logic.EMPTY_OPPORTUNITY_FILTERS);
  const first = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: lots, memberFeed: true }));
  assert.equal((first.match(/<article /g) ?? []).length, 24);
  assert.doesNotMatch(first, /Vestibular agrupado/);
  assert.match(first, /Mostrar mais oportunidades/);
  // Public default excludes vestibular, while management still sees every original record.
  const publicHtml = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: ordered }));
  assert.doesNotMatch(publicHtml, /Vestibular agrupado/);
  const adminHtml = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: ordered, management: true }));
  assert.match(adminHtml, /Vestibular agrupado/);
});


test("member board applies explicit search to course options and resets the server order", () => {
  const selected = opportunity({ id: "doctoral", title: "Seleção de doutorado em Física", isCourse: true, categories: ["formacao"], amountText: "Inscrição: R$ 100." });
  const event = opportunity({ id: "event", title: "Evento universitário para doutorandos", categories: ["eventos"] });
  query = "busca=Seleção+de+doutorado";
  try {
    const filters = logic.opportunityFiltersFromSearchParams(new URLSearchParams(query));
    const ordered = orderMemberFeed([event, selected], filters);
    const html = renderToStaticMarkup(React.createElement(OpportunitiesBoard, { opportunities: ordered, memberFeed: true }));
    assert.ok(html.includes(selected.title));
    assert.ok(!html.includes(event.title));
    assert.match(html, /1 oportunidade visível/);
  } finally { query = ""; }
});

test("member DAL authorizes, shares public priority and applies explicit queries", async () => {
  const calls = [];
  const formal = opportunity({ id: "formal", title: "Seleção de mestrado", isCourse: true, categories: ["formacao"], deadlineAt: "2099-01-01" });
  const event = opportunity({ id: "event", categories: ["eventos"], deadlineAt: "2099-12-01" });
  const isolated = opportunityLoader({
    "@/lib/members/dal": { requireMember: async (path) => calls.push(path) },
    "@/lib/admin/access": { requireAdmin: async () => {} },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => [formal, event] },
  });
  const access = isolated("lib/opportunities/access.ts");
  assert.deepEqual((await access.listPublicOpportunities()).map(i => i.id), [event.id, formal.id]);
  assert.equal(calls.length, 0);
  assert.deepEqual((await access.listMemberOpportunities()).map(i => i.id), [event.id, formal.id]);
  assert.deepEqual(calls, ["/membros/oportunidades"]);
  assert.deepEqual((await access.listMemberOpportunities({ ...logic.EMPTY_OPPORTUNITY_FILTERS, query: "mestrado" })).map(i => i.id), [formal.id]);
  // An unavailable location is sanitized consistently with the board, preserving default editorial order.
  assert.deepEqual((await access.listMemberOpportunities({ ...logic.EMPTY_OPPORTUNITY_FILTERS, stateCode: "SC" })).map(i => i.id), [event.id, formal.id]);
});


test("ambiguous degree funding stays below activities, while researcher selection is not degree admission", () => {
  const event = opportunity({ id: "event", title: "Encontro para doutorandos", categories: ["eventos"] });
  for (const degree of ["Mestrado", "Doutorado"]) {
    const funding = opportunity({ id: degree, title: `Bolsa de ${degree} em Física`, categories: ["pesquisa", "bolsas"], benefitType: "research_scholarship", amountText: "Bolsa de R$ 10000 / mês." });
    assert.equal(funding.editorialNature, "unclassified");
    assert.equal(orderMemberFeed([funding, event], logic.EMPTY_OPPORTUNITY_FILTERS)[0], event);
  }
  for (const title of ["Seleção de pesquisadores com doutorado", "Seleção para projeto extracurricular de estudantes de doutorado"]) {
    const project = opportunity({ title, categories: ["pesquisa"] });
    assert.equal(project.editorialNature, "extracurricular");
  }
  assert.equal(opportunity({ title: "Seleção para o programa de doutorado em Física", categories: ["formacao"], isCourse: true }).editorialNature, "formal_admission");
});

test("events and concrete extracurricular projects precede generic paid research before the first page", () => {
  const research = Array.from({ length: 30 }, (_, i) => opportunity({ id: `research-${i}`, title: "Seleção de pesquisadores", categories: ["pesquisa"], benefitType: "research_scholarship", amountText: "Bolsa de R$ 10000 / mês.", deadlineAt: "2099-01-01" }));
  const event = opportunity({ id: "event", title: "Encontro da Faculdade de Engenharia", categories: ["eventos"] });
  const hackathon = opportunity({ id: "hackathon" });
  const project = opportunity({ id: "project", title: "Projeto extracurricular de robótica", categories: ["formacao"] });
  const funding = opportunity({ id: "degree", title: "Bolsa de doutorado", categories: ["pesquisa"], benefitType: "research_scholarship" });
  const admission = opportunity({ id: "admission", title: "Seleção para graduação", categories: ["formacao"], amountText: "Remuneração: R$ 10000." });
  const ordered = orderMemberFeed([admission, funding, ...research, project, event, hackathon], logic.EMPTY_OPPORTUNITY_FILTERS);
  assert.deepEqual(new Set(ordered.slice(0, 3).map(i => i.id)), new Set([project.id, event.id, hackathon.id]));
  assert.equal(ordered[3], research[0]);
  assert.equal(ordered.at(-2), funding);
  assert.equal(ordered.at(-1), admission);
  assert.equal(ordered.length, 35);
});

test("project focus needs explicit context or structured extension funding, never a university or generic degree", () => {
  for (const title of ["Projeto extracurricular de robótica", "Projetos extracurriculares", "Projeto de extensão em comunidade", "Projeto de voluntariado", "Programa de voluntariado", "Projeto de iniciação científica"]) {
    const project = opportunity({ title, categories: ["formacao"] });
    assert.equal(project.editorialNature, "extracurricular", title);
    assert.equal(project.editorialFocus, "extracurricular_project", title);
  }
  assert.equal(opportunity({ title: "Bolsa de extensão", benefitType: "extension_scholarship", categories: ["bolsas"] }).editorialFocus, "extracurricular_project");
  for (const patch of [
    { title: "Projeto de pesquisa em Física", categories: ["pesquisa"] },
    { title: "Bolsa para doutorandos", categories: ["pesquisa"] },
    { title: "Faculdade de Engenharia", categories: ["formacao"], isCourse: true },
    { title: "Bolsa de doutorado", categories: ["pesquisa"], benefitType: "research_scholarship" },
  ]) assert.equal(opportunity(patch).editorialFocus, null);
  const universityEvent = opportunity({ title: "Evento para doutorandos na Faculdade", categories: ["eventos"] });
  assert.equal(universityEvent.editorialFocus, "event_or_competition");
});

test("explicit entrance requirements override an event tag without penalizing vestibular preparation events", () => {
  for (const requirementsText of ["Ingresso na graduação por vestibular.", "Exige aprovação no vestibular.", "É necessário ser aprovado no vestibular."]) {
    const admission = opportunity({ title: "Vagas em Engenharia", categories: ["eventos"], requirementsText });
    assert.equal(admission.editorialNature, "formal_admission", requirementsText);
    assert.equal(admission.editorialFocus, null);
  }
  for (const requirementsText of ["Não exige aprovação no vestibular.", "Não é necessário ser aprovado no vestibular.", "Orientação sobre ingresso na graduação por vestibular."]) {
    const event = opportunity({ title: "Evento de preparação para o vestibular", categories: ["eventos"], requirementsText });
    assert.equal(event.editorialFocus, "event_or_competition", requirementsText);
  }
});

test("location and education filters retain activity priority; explicit topics and search override it", () => {
  const event = opportunity({ id: "event", categories: ["eventos"], stateCode: "SC", cityName: "Florianópolis", applicantType: "undergraduate_student" });
  const course = opportunity({ id: "course", title: "Seleção de graduação", categories: ["formacao"], stateCode: "SC", cityName: "Florianópolis", applicantType: "undergraduate_student", deadlineAt: "2099-01-01" });
  for (const patch of [{ stateCode: "SC" }, { stateCode: "SC", cityName: "Florianópolis" }, { level: "Graduação" }, { query: "   " }]) {
    const filters = { ...logic.EMPTY_OPPORTUNITY_FILTERS, ...patch };
    const ordered = orderMemberFeed([course, event], filters);
    assert.equal(ordered[0], event);
    assert.deepEqual(logic.filterOpportunities(ordered, filters, "2099-01-01", true).map(i => i.id), [event.id, course.id]);
  }
  for (const patch of [{ category: "formacao" }, { kind: "Curso" }, { query: "graduação" }]) {
    assert.equal(orderMemberFeed([event, course], { ...logic.EMPTY_OPPORTUNITY_FILTERS, ...patch })[0], course);
  }
});
