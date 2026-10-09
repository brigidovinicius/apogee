import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../lib/opportunities/location.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const location = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("the canonical UF contract contains the 27 unique Brazilian codes", () => {
  assert.equal(location.BRAZILIAN_STATE_CODES.length, 27);
  assert.equal(new Set(location.BRAZILIAN_STATE_CODES).size, 27);
  assert.deepEqual(location.BRAZILIAN_STATE_CODES.slice(0, 4), ["AC", "AL", "AP", "AM"]);
  assert.ok(location.BRAZILIAN_STATE_CODES.includes("DF"));
});

test("location normalization preserves missing data and rejects a city without a valid UF", () => {
  assert.deepEqual(location.normalizeBrazilianLocation({}), {
    status: "missing", location: { stateCode: null, cityName: null },
  });
  assert.deepEqual(location.normalizeBrazilianLocation({ stateCode: " sp ", cityName: " Praia   Grande " }), {
    status: "valid", location: { stateCode: "SP", cityName: "Praia Grande" },
  });
  assert.equal(location.normalizeBrazilianLocation({ cityName: "Santos" }).status, "invalid");
  assert.equal(location.normalizeBrazilianLocation({ stateCode: "XX", cityName: "Santos" }).status, "invalid");
});
