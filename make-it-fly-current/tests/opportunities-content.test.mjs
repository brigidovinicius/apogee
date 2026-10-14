import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const catalogueSource = (await readFile(new URL("../content/opportunities.ts", import.meta.url), "utf8"))
  .replace(/^import "server-only";\s*/m, "");
const { outputText } = ts.transpileModule(catalogueSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const catalogue = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const locationSource = await readFile(new URL("../lib/opportunities/location.ts", import.meta.url), "utf8");
const logicSource = (await readFile(new URL("../lib/opportunities/types.ts", import.meta.url), "utf8"))
  .replace(/^import \{[\s\S]*?\} from "@\/lib\/opportunities\/location";\s*/m, "");
const { outputText: logicOutput } = ts.transpileModule(`${locationSource}\n${logicSource}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const logic = await import(`data:text/javascript;base64,${Buffer.from(logicOutput).toString("base64")}`);

test("the public catalogue contains only unique official HTTPS links", () => {
  const ids = new Set();
  for (const opportunity of catalogue.STUDENT_OPPORTUNITIES) {
    assert.ok(!ids.has(opportunity.id), `duplicate id: ${opportunity.id}`);
    ids.add(opportunity.id);
    assert.match(opportunity.officialUrl, /^https:\/\//);
    assert.match(opportunity.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(opportunity.eligibility.length > 30);
    assert.ok(opportunity.benefit.length > 15);
  }
});

test("distinct courses from one official notice remain separate in the catalogue", () => {
  const base = catalogue.STUDENT_OPPORTUNITIES[0];
  const notice = "https://portal.ifpe.edu.br/noticias/cursos/";
  const electrician = { ...base, id: "course-electrician", title: "Eletricista Industrial", officialUrl: notice, kind: "Curso" };
  const welder = { ...base, id: "course-welder", title: "Soldador", officialUrl: notice, kind: "Curso" };
  assert.deepEqual(logic.mergeOpportunities([electrician], [welder, { ...electrician }]).map((item) => item.id), [
    "course-electrician", "course-welder",
  ]);
});

test("expired fixed-date opportunities are not rendered and continuous flows remain visible", () => {
  const today = "2026-10-02";
  const expired = catalogue.STUDENT_OPPORTUNITIES.find((item) => item.id === "ufcspa-proext-2026");
  const continuous = catalogue.STUDENT_OPPORTUNITIES.find((item) => item.id === "bolsa-permanencia-indigena-quilombola");
  assert.equal(logic.isOpportunityOpen(expired, today), false);
  assert.equal(logic.isOpportunityOpen(continuous, today), true);
});

test("catalogue is ordered by deadline with continuous opportunities last", () => {
  const ordered = logic.sortByDeadline(catalogue.STUDENT_OPPORTUNITIES);
  assert.equal(ordered.at(-1).deadline, null);
  for (let index = 1; index < ordered.length - 1; index++) {
    assert.ok(ordered[index - 1].deadline <= ordered[index].deadline);
  }
});

test("initial Radar view keeps broad opportunities, closest deadlines and confirmed paid ties first", () => {
  const base = catalogue.STUDENT_OPPORTUNITIES[0];
  const items = [
    { ...base, id: "postdoc", title: "Bolsa de PD em Física", level: "Público diverso", deadline: "2026-10-15", benefit: "R$ 10.000" },
    { ...base, id: "later-paid", title: "Estágio de tecnologia", level: "Graduação", deadline: "2026-10-30", benefit: "Bolsa de R$ 2.500" },
    { ...base, id: "urgent-unpaid", title: "Hackathon aberto", level: "Público diverso", deadline: "2026-10-16", benefit: "Sem remuneração" },
    { ...base, id: "urgent-paid", title: "Estágio municipal", level: "Graduação", deadline: "2026-10-16", benefit: "Bolsa de R$ 1.000" },
    { ...base, id: "masters", title: "Bolsa de Mestrado", level: "Pós-graduação", deadline: "2026-10-17", benefit: "R$ 3.000" },
  ];
  assert.deepEqual(logic.initialRadarOpportunities(items).map((item) => item.id), ["urgent-paid", "urgent-unpaid", "later-paid"]);
  assert.equal(logic.filterOpportunities(items, logic.EMPTY_OPPORTUNITY_FILTERS, "2026-10-14").length, 5);
});

test("filter options come only from structured fields on open opportunities", () => {
  const opportunities = [
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "open-bolsa-graduacao",
      kind: "Bolsa",
      level: "Graduação",
      deadline: "2026-10-20",
    },
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "open-programa-medio",
      kind: "Programa",
      level: "Ensino médio",
      deadline: null,
    },
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "expired-intercambio-pos",
      kind: "Intercâmbio",
      level: "Pós-graduação",
      deadline: "2026-10-01",
    },
  ];

  assert.deepEqual(logic.getOpportunityFilterOptions(opportunities, "2026-10-08"), {
    kinds: ["Bolsa", "Programa"],
    levels: ["Ensino médio", "Graduação"],
    states: [],
    citiesByState: {},
  });
});

test("filters combine, count active selections and clear without mutating the catalogue", () => {
  const opportunities = [
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "bolsa-graduacao",
      kind: "Bolsa",
      level: "Graduação",
      deadline: "2026-10-20",
    },
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "bolsa-medio",
      kind: "Bolsa",
      level: "Ensino médio",
      deadline: "2026-10-21",
    },
    {
      ...catalogue.STUDENT_OPPORTUNITIES[0],
      id: "programa-graduacao",
      kind: "Programa",
      level: "Graduação",
      deadline: "2026-10-22",
    },
  ];
  const combined = { kind: "Bolsa", level: "Graduação", stateCode: null, cityName: null };

  assert.equal(logic.countActiveOpportunityFilters(combined), 2);
  assert.deepEqual(
    logic.filterOpportunities(opportunities, combined, "2026-10-08").map((item) => item.id),
    ["bolsa-graduacao"],
  );
  assert.equal(logic.countActiveOpportunityFilters(logic.EMPTY_OPPORTUNITY_FILTERS), 0);
  assert.deepEqual(
    logic
      .filterOpportunities(opportunities, logic.EMPTY_OPPORTUNITY_FILTERS, "2026-10-08")
      .map((item) => item.id),
    ["bolsa-graduacao", "bolsa-medio", "programa-graduacao"],
  );
  assert.equal(opportunities.length, 3);
});

test("UF and city filters are dependent, canonical and combined with the other filters", () => {
  const base = catalogue.STUDENT_OPPORTUNITIES.find((item) => item.id === "praia-grande-bolsa-ensino-medio-2026");
  const opportunities = [
    { ...base, id: "sp-praia-bolsa", kind: "Bolsa", level: "Graduação", stateCode: "SP", cityName: "Praia Grande" },
    { ...base, id: "sp-santos-programa", kind: "Programa", level: "Graduação", stateCode: "SP", cityName: "Santos" },
    { ...base, id: "sc-praia-bolsa", kind: "Bolsa", level: "Graduação", stateCode: "SC", cityName: "Praia Grande" },
    { ...base, id: "missing-location", kind: "Bolsa", level: "Graduação", stateCode: null, cityName: null },
  ];
  const options = logic.getOpportunityFilterOptions(opportunities, "2026-10-08");

  assert.deepEqual(options.states, ["SC", "SP"]);
  assert.deepEqual(options.citiesByState, { SC: ["Praia Grande"], SP: ["Praia Grande", "Santos"] });
  assert.deepEqual(
    logic.filterOpportunities(opportunities, {
      kind: "Bolsa", level: "Graduação", stateCode: "SP", cityName: "Praia Grande",
    }, "2026-10-08").map((item) => item.id),
    ["sp-praia-bolsa"],
  );
  assert.deepEqual(
    logic.filterOpportunities(opportunities, logic.EMPTY_OPPORTUNITY_FILTERS, "2026-10-08").map((item) => item.id),
    ["sp-praia-bolsa", "sp-santos-programa", "sc-praia-bolsa", "missing-location"],
  );
});

test("URL filters round-trip and incompatible cities are cleared with the UF", () => {
  const params = new URLSearchParams("modalidade=Bolsa&formacao=Gradua%C3%A7%C3%A3o&uf=SP&cidade=Praia+Grande&origem=radar");
  const parsed = logic.opportunityFiltersFromSearchParams(params);
  assert.deepEqual(parsed, {
    kind: "Bolsa", level: "Graduação", stateCode: "SP", cityName: "Praia Grande",
  });
  assert.equal(logic.countActiveOpportunityFilters(parsed), 4);

  logic.setOpportunityFilterSearchParams(params, { ...parsed, stateCode: "SC", cityName: null });
  assert.equal(params.get("uf"), "SC");
  assert.equal(params.has("cidade"), false);
  assert.equal(params.get("origem"), "radar");

  const sanitized = logic.sanitizeOpportunityFilters(
    { ...parsed, stateCode: "SC", cityName: "Praia Grande" },
    { kinds: ["Bolsa"], levels: ["Graduação"], states: ["SC"], citiesByState: { SC: ["Florianópolis"] } },
  );
  assert.deepEqual(sanitized, { ...parsed, stateCode: "SC", cityName: null });
});

test("a confirmed national opportunity is available in all UFs and search cities without acquiring a false local address", () => {
  const national = catalogue.STUDENT_OPPORTUNITIES.find((item) => item.id === "pe-de-meia-licenciaturas-2026");
  const unknown = { ...national, id: "unknown-scope", nationallyEligible: false };
  const options = logic.getOpportunityFilterOptions([national, unknown], "2026-10-11");
  assert.equal(options.states.length, 27);
  assert.ok(options.citiesByState.SP.includes("Campinas"));
  assert.ok(options.citiesByState.AM.includes("Manaus"));
  const results = logic.filterOpportunities([national, unknown], {
    kind: null, level: null, stateCode: "AM", cityName: "Manaus",
  }, "2026-10-11");
  assert.deepEqual(results.map((item) => item.id), [national.id]);
  assert.equal(results[0].stateCode, null);
  assert.equal(results[0].location, "Brasil");
});

test("area keyword search combines with location and modality without guessing an area", () => {
  const base = catalogue.STUDENT_OPPORTUNITIES[0];
  const opportunities = [
    { ...base, id: "sp-soldagem", title: "Curso de soldagem", kind: "Curso", deadline: "2026-10-20", stateCode: "SP", cityName: "Santos" },
    { ...base, id: "sp-saude", title: "Curso de saúde", kind: "Curso", deadline: "2026-10-20", stateCode: "SP", cityName: "Santos" },
  ];
  const filters = { kind: "Curso", level: null, stateCode: "SP", cityName: "Santos", query: "soldagem" };
  assert.deepEqual(logic.filterOpportunities(opportunities, filters, "2026-10-08").map((item) => item.id), ["sp-soldagem"]);
  assert.equal(logic.countActiveOpportunityFilters(filters), 4);
  const params = logic.setOpportunityFilterSearchParams(new URLSearchParams(), filters);
  assert.equal(params.get("busca"), "soldagem");
  assert.equal(logic.opportunityFiltersFromSearchParams(params).query, "soldagem");
});

test("seven categories filter the same unique cards and round-trip in the URL", () => {
  assert.equal(logic.OPPORTUNITY_CATEGORIES.length, 7);
  const base = catalogue.STUDENT_OPPORTUNITIES[0];
  const opportunities = [
    { ...base, id: "course-with-aid", categories: ["formacao", "bolsas"], deadline: "2026-10-20" },
    { ...base, id: "event", categories: ["eventos"], deadline: "2026-10-20" },
    { ...base, id: "unclassified", categories: [], deadline: "2026-10-20" },
  ];
  const filters = { ...logic.EMPTY_OPPORTUNITY_FILTERS, category: "bolsas" };
  assert.deepEqual(logic.filterOpportunities(opportunities, filters, "2026-10-08").map((item) => item.id), ["course-with-aid"]);
  assert.deepEqual(logic.filterOpportunities(opportunities, { ...filters, category: "formacao" }, "2026-10-08").map((item) => item.id), ["course-with-aid"]);
  assert.equal(logic.filterOpportunities(opportunities, logic.EMPTY_OPPORTUNITY_FILTERS, "2026-10-08").length, 3);
  const params = logic.setOpportunityFilterSearchParams(new URLSearchParams(), filters);
  assert.equal(params.get("categoria"), "bolsas");
  assert.equal(logic.opportunityFiltersFromSearchParams(params).category, "bolsas");
  assert.equal(logic.countActiveOpportunityFilters(filters), 1);
});
