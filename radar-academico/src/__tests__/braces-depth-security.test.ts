import { test } from "vitest";

const helper = await import(new URL("../../../scripts/braces-depth-regressions.mjs", import.meta.url).href);
const cases: Array<[string, () => unknown]> = helper.bracesDepthCases(new URL("../../package.json", import.meta.url));
for (const [name, run] of cases) test(name, run);
