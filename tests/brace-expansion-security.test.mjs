import { braceExpansionSecurityTests } from "../scripts/brace-expansion-regressions.mjs";
braceExpansionSecurityTests(new URL("../package.json", import.meta.url));
