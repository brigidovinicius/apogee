import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const locationSource = await readFile(new URL("../lib/opportunities/location.ts", import.meta.url), "utf8");
const logicSource = (await readFile(new URL("../lib/opportunities/types.ts", import.meta.url), "utf8"))
  .replace(/^import \{[\s\S]*?\} from "@\/lib\/opportunities\/location";\s*/m, "");
const clientSource = (await readFile(new URL("../lib/opportunities/radar-client.ts", import.meta.url), "utf8"))
  .replace(/^import "server-only";\s*/m, "")
  .replace(/^import \{[\s\S]*?\} from "@\/lib\/opportunities\/types";\s*/m, "")
  .replace(/^import \{ normalizeBrazilianLocation \} from "@\/lib\/opportunities\/location";\s*/m, "");
const output = ts.transpileModule(`${locationSource}\n${logicSource}\n${clientSource}`, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("Radar preserves the Brazilian calendar day for date-only and exact deadlines", async () => {
  const previousUrl = process.env.RADAR_ACADEMICO_API_URL;
  const previousToken = process.env.RADAR_ACADEMICO_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.RADAR_ACADEMICO_API_URL = "http://radar.test/api/public/opportunities";
  process.env.RADAR_ACADEMICO_API_TOKEN = "fixture-token";

  try {
    const client = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
    const base = {
      title: "Bolsa verificada", institution: "Universidade",
      benefitType: "research_scholarship", applicantType: "undergraduate_student",
      categories: ["bolsas", "pesquisa"],
      officialUrl: "https://universidade.example/edital", lastCheckedAt: "2026-10-10T12:00:00Z",
      stateCode: null, cityName: null, requirementsText: "Confira o edital", amountText: "Bolsa",
    };
    globalThis.fetch = async () => new Response(JSON.stringify({
      version: 3, opportunities: [
        { ...base, id: "date-only", deadlineAt: "2026-10-10 00:00:00+00", deadlinePrecision: "date_only" },
        { ...base, id: "exact", deadlineAt: "2026-10-11T02:30:00Z", deadlinePrecision: "exact_datetime" },
      ],
    }), { status: 200 });

    const items = await client.listRadarOpportunities();
    assert.deepEqual(items.map((item) => item.id), ["radar-date-only", "radar-exact"]);
    assert.deepEqual(items.map((item) => item.deadline), ["2026-10-10", "2026-10-10"]);
    assert.deepEqual(items.map((item) => item.deadlineLabel), ["Inscrições até 10 de outubro", "Inscrições até 10 de outubro"]);
    assert.deepEqual(items[0].categories, ["bolsas", "pesquisa"]);
    globalThis.fetch = async () => new Response(JSON.stringify({ version: 3, opportunities: [{ ...base, id: "missing", deadlineAt: null, deadlinePrecision: "date_only" }] }));
    await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
    globalThis.fetch = async () => new Response("unavailable", { status: 503 });
    await assert.rejects(client.listRadarOpportunities(), /Catálogo indisponível/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.RADAR_ACADEMICO_API_URL;
    else process.env.RADAR_ACADEMICO_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.RADAR_ACADEMICO_API_TOKEN;
    else process.env.RADAR_ACADEMICO_API_TOKEN = previousToken;
  }
});

test("FAPESP postdoctoral titles are labelled as postgraduate rather than broad audience", async () => {
  const client = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const item = client.toOpportunity({
    id: "postdoc", title: "Bolsa de PD em Física", institution: "Universidade",
    benefitType: "research_scholarship", applicantType: "graduate_professional", categories: ["bolsas", "pesquisa"],
    officialUrl: "https://fapesp.br/oportunidades/fisica/9999/", lastCheckedAt: "2026-10-14T12:00:00Z",
    stateCode: null, cityName: null, requirementsText: "Consulte o edital", amountText: "Bolsa de R$ 12.000",
    deadlineAt: "2026-10-20", deadlinePrecision: "date_only", opportunityStatus: "open",
  });
  assert.equal(item?.level, "Pós-graduação");
});
