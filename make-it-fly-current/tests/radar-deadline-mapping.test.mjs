import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const locationSource = await readFile(new URL("../lib/opportunities/location.ts", import.meta.url), "utf8");
const clientSource = (await readFile(new URL("../lib/opportunities/radar-client.ts", import.meta.url), "utf8"))
  .replace(/^import "server-only";\s*/m, "")
  .replace(/^import \{[\s\S]*?\} from "@\/lib\/opportunities\/types";\s*/m, "")
  .replace(/^import \{ normalizeBrazilianLocation \} from "@\/lib\/opportunities\/location";\s*/m, "");
const output = ts.transpileModule(`${locationSource}\n${clientSource}`, {
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
      officialUrl: "https://universidade.example/edital", lastCheckedAt: "2026-10-10T12:00:00Z",
      stateCode: null, cityName: null, requirementsText: "Confira o edital", amountText: "Bolsa",
    };
    globalThis.fetch = async () => new Response(JSON.stringify({
      version: 2, opportunities: [
        { ...base, id: "date-only", deadlineAt: "2026-10-10 00:00:00+00", deadlinePrecision: "date_only" },
        { ...base, id: "exact", deadlineAt: "2026-10-11T02:30:00Z", deadlinePrecision: "exact_datetime" },
        { ...base, id: "missing", deadlineAt: null, deadlinePrecision: "date_only" },
      ],
    }), { status: 200 });

    const items = await client.listRadarOpportunities();
    assert.deepEqual(items.map((item) => item.id), ["radar-date-only", "radar-exact"]);
    assert.deepEqual(items.map((item) => item.deadline), ["2026-10-10", "2026-10-10"]);
    assert.deepEqual(items.map((item) => item.deadlineLabel), ["Inscrições até 10 de outubro", "Inscrições até 10 de outubro"]);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.RADAR_ACADEMICO_API_URL;
    else process.env.RADAR_ACADEMICO_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.RADAR_ACADEMICO_API_TOKEN;
    else process.env.RADAR_ACADEMICO_API_TOKEN = previousToken;
  }
});
