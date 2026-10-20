import { proxyAddrSecurityTests } from "../scripts/proxy-addr-regressions.mjs";
proxyAddrSecurityTests(new URL("../package.json", import.meta.url));
