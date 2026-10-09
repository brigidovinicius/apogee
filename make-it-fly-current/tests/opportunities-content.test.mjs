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
