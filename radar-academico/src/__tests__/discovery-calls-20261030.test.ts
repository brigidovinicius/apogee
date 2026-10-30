import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";
import { DISCOVERY_CALLS, normalizeDiscoveryCall } from "@/lib/ingestion/normalize-discovery-calls-20261030";
import { publicationIssue } from "@/lib/ingestion/publication";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import { prepareLeadCandidate } from "@/lib/discovery/lead-candidate";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
vi.mock("@/lib/ingestion/fetch-source", () => ({ fetchOfficialResource: vi.fn() }));
const now = new Date("2026-10-30T16:00:00Z");
const sourceFor = (call: typeof DISCOVERY_CALLS[number]): OfficialSource => ({
  id: call.id, name: call.title, institutionName: "Universidade Federal de Santa Catarina", institutionAcronym: "UFSC",
  sourceType: "federal_university", baseUrl: call.url, allowedDomains: ["noticias.ufsc.br"],
  allowedPathPrefixes: [new URL(call.url).pathname], listingUrls: [call.url], extractionMode: "html",
  audienceScope: [], geographicScope: [], categories: [], priority: 60, active: true,
});
const htmlFor = (id: string) => readFileSync(new URL("./fixtures/discovery-20261030/" + id + ".html", import.meta.url), "utf8");
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });
it.each(DISCOVERY_CALLS)("validates the current official article for $id", call => {
  const source = sourceFor(call);
  const [candidate] = normalizeDiscoveryCall(htmlFor(call.id), source, now);
  expect(candidate.title).toBe(call.title);
  expect(candidate.opportunityStatus).toBe("open");
  expect(publicationIssue(candidate, source, now)).toBeNull();
  for (const proof of Object.values(candidate.evidenceJson)) expect(isOfficialSourceUrl(proof.source_url, [source])).toBe(true);
});
it("preserves the exact time of the school application deadline and distinguishes it from the result date", () => {
  const call = DISCOVERY_CALLS[2];
  const [candidate] = normalizeDiscoveryCall(htmlFor(call.id), sourceFor(call), now);
  expect(candidate.deadlineAt).toBe("2026-11-10T18:00:00-03:00");
  expect(candidate.deadlinePrecision).toBe("exact_datetime");
  expect(candidate.applicantType).toBe("mixed");
});
it("does not turn a limited fee exemption into free entry for everyone", () => {
  const call = DISCOVERY_CALLS[3];
  const [candidate] = normalizeDiscoveryCall(htmlFor(call.id), sourceFor(call), now);
  expect(candidate.deadlineAt).toBe("2026-11-12");
  expect(candidate.eventStartsAt).toBe("2026-11-23");
  expect(candidate.amountText).toContain("20 isenções");
  expect(candidate.amountText).toContain("não presumir gratuidade".replace("não", "Não"));
});
it("treats the public festival start as an event date, without fabricating a registration deadline", () => {
  const call = DISCOVERY_CALLS[4];
  const [candidate] = normalizeDiscoveryCall(htmlFor(call.id), sourceFor(call), now);
  expect(candidate.deadlineAt).toBeUndefined();
  expect(candidate.deadlinePrecision).toBe("not_informed");
  expect(candidate.eventStartsAt).toBe("2026-11-03");
  const [started] = normalizeDiscoveryCall(htmlFor(call.id), sourceFor(call), new Date("2026-11-03T03:01:00Z"));
  expect(started.opportunityStatus).toBe("closed");
});
it("does not publish expired registration or silently accept a changed deadline, eligibility or registration URL", () => {
  const call = DISCOVERY_CALLS[0], source = sourceFor(call), html = htmlFor(call.id);
  const [expired] = normalizeDiscoveryCall(html, source, new Date("2026-10-31T12:00:00Z"));
  expect(expired.opportunityStatus).toBe("closed");
  expect(() => normalizeDiscoveryCall(html.replace("1º a 30 de outubro", "1º a 30 de novembro"), source, now)).toThrow();
  expect(() => normalizeDiscoveryCall(html.replace("15 vagas para Análises Clínicas", "50 vagas para Análises Clínicas"), source, now)).toThrow();
  expect(() => normalizeDiscoveryCall(html.replaceAll("cdCurso=41010044", "cdCurso=wrong"), source, now)).toThrow();
});
it("refuses a listing containing two articles instead of attributing a sidebar deadline to a call", () => {
  const call = DISCOVERY_CALLS[0];
  expect(() => normalizeDiscoveryCall(htmlFor(call.id) + "<article>Inscrições abertas até 31/12/2027</article>", sourceFor(call), now)).toThrow();
});
it("refuses unverified scopes, private destinations and disabled sources before fetching", async () => {
  const call = DISCOVERY_CALLS[0], source = sourceFor(call);
  for (const url of ["https://outside.example.org/call", "https://127.0.0.1/call", "http://noticias.ufsc.br/call"]) {
    expect(await prepareLeadCandidate({ id: "lead", target_id: "target", url, title: "Inscrições abertas" }, [source])).toEqual({ reason: "scope_unverified" });
  }
  expect(await prepareLeadCandidate({ id: "lead", target_id: "target", url: call.url, title: call.title }, [{ ...source, active: false }]))
    .toEqual({ reason: "scope_unverified" });
  expect(fetchOfficialResource).not.toHaveBeenCalled();
});
it("uses the audited complete article and evidence instead of publishing the teaser in the discovery link", async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const call = DISCOVERY_CALLS[3], source = sourceFor(call);
  vi.mocked(fetchOfficialResource).mockResolvedValue({ body: Buffer.from(htmlFor(call.id)), contentType: "text/html", hash: "fixture", cached: false });
  const result = await prepareLeadCandidate({ id: "lead", target_id: "target", url: call.url, title: "formulário" }, [source]);
  expect(result).toMatchObject({ source: { id: call.id }, candidate: { title: call.title, deadlineAt: "2026-11-12" } });
  expect(fetchOfficialResource).toHaveBeenCalledTimes(1);
});
