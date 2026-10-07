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
const logicSource = await readFile(new URL("../lib/opportunities/types.ts", import.meta.url), "utf8");
const { outputText: logicOutput } = ts.transpileModule(logicSource, {
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
