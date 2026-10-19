import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { opportunityLoader } from "../tests/helpers/load-opportunity-module.mjs";
// Input is a saved public StudentOpportunity[] snapshot, never a private DB export.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error("Usage: audit-radar-catalogue.mjs input.json output.json");
const items = JSON.parse(await readFile(input, "utf8"));
const load = opportunityLoader();
const { buildOpportunityPage } = load("lib/opportunities/catalogue.ts");
const { groupAdmissionProcesses } = load("lib/opportunities/admission-processes.ts");
const { normalizePublicText } = load("lib/opportunities/radar-client.ts");
const data = items.map(item => ({ ...item, eligibility: normalizePublicText(item.eligibility) }));
const before = performance.now();
const queries = ["", "categoria=vestibular", "categoria=vestibular&uf=SC&cidade=Gaspar", "uf=SC&cidade=Gaspar", "categoria=eventos", "pagina=2"];
const cases = queries.map(query => {
  const result = buildOpportunityPage(data, new URLSearchParams(query));
  return { query, total: result.total, serializedRecords: result.opportunities.length, page: result.page, pageCount: result.pageCount,
    categories: result.coverage.byCategory, serializedBytes: Buffer.byteLength(JSON.stringify(result)),
    firstIds: result.opportunities.slice(0, 8).map(item => item.id),
    exams: result.opportunities.filter(item => item.admissionProcess).length };
});
const report = { capturedAt: new Date().toISOString(), snapshotInput: input,
  originalRecords: data.length, originalGroupedTotal: groupAdmissionProcesses(data).total,
  originalJsonBytes: Buffer.byteLength(JSON.stringify(items)), elapsedMs: Math.round(performance.now() - before), cases,
  originalIdsUnchanged: JSON.stringify(items.map(item => item.id)) === JSON.stringify(data.map(item => item.id)),
  storedFieldsUntouched: true };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
