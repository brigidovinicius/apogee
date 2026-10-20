import test from "node:test";
import { bracesDepthCases } from "../../scripts/braces-depth-regressions.mjs";
for (const [name, run] of bracesDepthCases(new URL("../package.json", import.meta.url))) test(name, run);
