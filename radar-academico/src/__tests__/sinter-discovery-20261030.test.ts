import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";
import { publicationIssue } from "@/lib/ingestion/publication";
import { SINTER_DISCOVERY_CALLS, SINTER_DISCOVERY_INDEX, normalizeSinterDiscoveryCall, sinterLeadAliases } from "@/lib/ingestion/normalize-sinter-discovery-20261030";
const now = new Date("2026-10-30T16:00:00Z");
const fixture = (name: string) => readFileSync(new URL("./fixtures/discovery-20261030/" + name, import.meta.url), "utf8");
const listing = () => fixture("sinter-index.html");
const supplement = (id: string) => fixture(id + (id.includes("posgrado") ? ".txt" : ".html"));
const sourceFor = (call: typeof SINTER_DISCOVERY_CALLS[number]): OfficialSource => ({
  id: call.id, name: call.title, institutionName: "Universidade Federal de Santa Catarina", institutionAcronym: "UFSC",
  sourceType: "federal_university", baseUrl: SINTER_DISCOVERY_INDEX, allowedDomains: ["sinter.ufsc.br"],
  allowedPathPrefixes: [new URL(SINTER_DISCOVERY_INDEX).pathname, new URL(call.supplement).pathname, ...sinterLeadAliases(call.id).map(url => new URL(url).pathname)],
  listingUrls: [SINTER_DISCOVERY_INDEX], extractionMode: "html", audienceScope: [], geographicScope: [],
  categories: ["intercambios"], priority: 60, active: true,
});
it.each(SINTER_DISCOVERY_CALLS)("validates both current official evidences for $id", call => {
  const [candidate] = normalizeSinterDiscoveryCall(listing(), supplement(call.id), sourceFor(call), now);
  expect(publicationIssue(candidate, sourceFor(call), now)).toBeNull();
  expect(candidate.sourcePageUrl).toBe(call.supplement);
  expect(candidate.applicantType).toBe(call.applicant);
  expect(candidate.opportunityStatus).toBe("open");
});
it("distinguishes the teacher registration deadline from the later appeals deadline", () => {
  const call = SINTER_DISCOVERY_CALLS[1], text = supplement(call.id);
  expect(text).toContain("13 de novembro");
  const [candidate] = normalizeSinterDiscoveryCall(listing(), text, sourceFor(call), now);
  expect(candidate.deadlineAt).toBe("2026-11-03");
  expect(candidate.hasRetification).toBe(true);
});
it("keeps distinct canonical pages for three selections on the same index", () => {
  const candidates = SINTER_DISCOVERY_CALLS.map(call => normalizeSinterDiscoveryCall(listing(), supplement(call.id), sourceFor(call), now)[0]);
  expect(new Set(candidates.map(c => c.sourcePageUrl)).size).toBe(3);
  expect(candidates.map(c => c.deadlineAt)).toEqual(["2026-11-09", "2026-11-03", "2026-11-05"]);
});
it("retains the last valid day in Brasilia and closes the following day", () => {
  const call = SINTER_DISCOVERY_CALLS[2], source = sourceFor(call);
  expect(normalizeSinterDiscoveryCall(listing(), supplement(call.id), source, new Date("2026-11-06T02:59:59Z"))[0].opportunityStatus).toBe("open");
  expect(normalizeSinterDiscoveryCall(listing(), supplement(call.id), source, new Date("2026-11-06T03:00:00Z"))[0].opportunityStatus).toBe("closed");
});
it("does not accept missing, conflicting or out-of-scope official evidence", () => {
  const call = SINTER_DISCOVERY_CALLS[0], source = sourceFor(call), html = listing(), body = supplement(call.id);
  expect(() => normalizeSinterDiscoveryCall("<article><table></table></article><aside>" + html + "</aside>", body, source, now)).toThrow();
  expect(() => normalizeSinterDiscoveryCall(html, "", source, now)).toThrow();
  expect(() => normalizeSinterDiscoveryCall(html.replaceAll("9 de novembro de 2026", "10 de novembro de 2026"), body, source, now)).toThrow();
  expect(() => normalizeSinterDiscoveryCall(html, body, { ...source, allowedPathPrefixes: ["/editais-abertos/"] }, now)).toThrow();
  expect(() => normalizeSinterDiscoveryCall(html, body, { ...source, baseUrl: "https://sinter.ufsc.br/editais-abertos/" }, now)).toThrow();
});

it("repairs only the verified PDF.js year and edital tokens without changing a different edition", () => {
  const call = SINTER_DISCOVERY_CALLS[2], text = supplement(call.id);
  expect(text).toContain("202 6");
  expect(text).toContain("1 /SINTER");
  expect(normalizeSinterDiscoveryCall(listing(), text, sourceFor(call), now)[0].deadlineAt).toBe("2026-11-05");
  expect(() => normalizeSinterDiscoveryCall(listing(), text.replaceAll("202 6", "201 6"), sourceFor(call), now)).toThrow();
});
