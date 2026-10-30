import { FAPESC_CTI_ID, FAPESC_CTI_URL } from "@/lib/ingestion/normalize-fapesc-cti-2026";
import { expect, it } from "vitest";
import { DISCOVERY_CALLS } from "@/lib/ingestion/normalize-discovery-calls-20261030";
import { SINTER_DISCOVERY_CALLS, SINTER_DISCOVERY_INDEX, sinterLeadAliases } from "@/lib/ingestion/normalize-sinter-discovery-20261030";
import { prepareLeadCandidate } from "@/lib/discovery/lead-candidate";
import type { OfficialSource } from "@/lib/ingestion/types";
// Explicit, read-only operator audit. Normal CI must never query live sites.
const audit = it.skipIf(process.env.RADAR_LIVE_AUDIT !== "true");
const sources: OfficialSource[] = [
  {id:FAPESC_CTI_ID,name:"CECTI",institutionName:"FAPESC",institutionAcronym:"FAPESC",sourceType:"government_foundation",baseUrl:FAPESC_CTI_URL,listingUrls:[FAPESC_CTI_URL],allowedDomains:["fapesc.sc.gov.br"],allowedPathPrefixes:[new URL(FAPESC_CTI_URL).pathname],extractionMode:"html",audienceScope:[],geographicScope:[],categories:[],priority:60,active:true},
  ...DISCOVERY_CALLS.map(call => ({
    id: call.id, name: call.title, institutionName: "Universidade Federal de Santa Catarina", institutionAcronym: "UFSC",
    sourceType: "federal_university" as const, baseUrl: call.url, allowedDomains: ["noticias.ufsc.br"],
    allowedPathPrefixes: [new URL(call.url).pathname], listingUrls: [call.url], extractionMode: "html" as const,
    audienceScope: [], geographicScope: [], categories: [], priority: 60, active: true,
  })),
  ...SINTER_DISCOVERY_CALLS.map(call => ({
    id: call.id, name: call.title, institutionName: "Universidade Federal de Santa Catarina", institutionAcronym: "UFSC",
    sourceType: "federal_university" as const, baseUrl: SINTER_DISCOVERY_INDEX, allowedDomains: ["sinter.ufsc.br"],
    allowedPathPrefixes: [new URL(SINTER_DISCOVERY_INDEX).pathname, new URL(call.supplement).pathname,
      ...sinterLeadAliases(call.id).map(url => new URL(url).pathname)],
    listingUrls: [SINTER_DISCOVERY_INDEX], extractionMode: "html" as const,
    audienceScope: [], geographicScope: [], categories: [], priority: 60, active: true,
  })),
];
audit.each(sources)("checks the real official evidence for $id without a database", async source => {
  const sinter = SINTER_DISCOVERY_CALLS.find(call => call.id === source.id);
  const url = sinter ? sinterLeadAliases(source.id)[0] ?? sinter.supplement : source.baseUrl;
  const result = await prepareLeadCandidate({ id: "operator-audit", target_id: "operator-audit", url, title: source.name }, sources);
  if ("reason" in result) throw new Error(source.id + ": " + result.reason);
  expect(result.candidate.opportunityStatus).toBe("open");
  expect(result.candidate.officialSourceId).toBe(source.id);
  console.log(JSON.stringify({ sourceId: source.id, title: result.candidate.title,
    deadline: result.candidate.deadlineAt ?? null, start: result.candidate.eventStartsAt ?? null, eligible: true }));
}, 180_000);
