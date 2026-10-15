import { readFileSync } from "node:fs";
import { ACIM_SW_SOURCE_ID, ACIM_SW_URL } from "@/lib/ingestion/normalize-acim-startup-weekend";
import type { OfficialSource } from "@/lib/ingestion/types";
export const acimHtml = readFileSync(new URL("./acim-startup-weekend.html", import.meta.url), "utf8");
export const acimSource: OfficialSource = { id: ACIM_SW_SOURCE_ID, name: "Startup Weekend Imbituba — 2026", institutionName: "Associação Empresarial de Imbituba (ACIM)", institutionAcronym: "ACIM", sourceType: "corporate_organizer", baseUrl: ACIM_SW_URL, listingUrls: [ACIM_SW_URL], allowedDomains: ["www.acimimbituba.org"], allowedPathPrefixes: [new URL(ACIM_SW_URL).pathname], extractionMode: "html", audienceScope: ["mixed"], geographicScope: ["SC"], categories: ["eventos"], priority: 85, active: true };
