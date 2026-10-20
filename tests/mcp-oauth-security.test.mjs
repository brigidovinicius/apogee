import { mcpOAuthSecurityTests } from "../scripts/mcp-oauth-regressions.mjs";
await mcpOAuthSecurityTests(new URL("../package.json", import.meta.url));
