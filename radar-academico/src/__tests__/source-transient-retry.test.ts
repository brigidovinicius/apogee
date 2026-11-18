import { afterEach, expect, it, vi } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";
vi.mock("@/lib/ingestion/safe-request", () => ({ safeRequest: vi.fn() }));
vi.mock("@/lib/ingestion/request-budget", () => ({ waitForOfficialRequest: vi.fn(async () => {}) }));
import { safeRequest } from "@/lib/ingestion/safe-request";
import { waitForOfficialRequest } from "@/lib/ingestion/request-budget";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";

let sequence = 0;
function source(): OfficialSource {
  const host = `gateway-${++sequence}.example.edu.br`;
  return { id: `gateway-${sequence}`, name: "Test source", institutionName: "Test", institutionAcronym: "",
    sourceType: "federal_university", baseUrl: `https://${host}/open`, listingUrls: [`https://${host}/open`],
    allowedDomains: [host], allowedPathPrefixes: ["/open"], extractionMode: "html", audienceScope: ["mixed"],
    geographicScope: [], categories: [], priority: 1, active: true };
}
const response = (status: number, body = "", headers = {}) => new Response(body, { status, headers });
afterEach(() => { vi.resetAllMocks(); });

it("recovers from one transient robots gateway failure only after a fresh successful robots response", async () => {
  const s = source();
  vi.mocked(safeRequest).mockResolvedValueOnce(response(502)).mockResolvedValueOnce(response(200, "User-agent: *\nAllow: /"))
    .mockResolvedValueOnce(response(200, "official page", { "content-type": "text/html" }));
  expect((await fetchOfficialResource(s.baseUrl, s)).body.toString()).toBe("official page");
  expect(vi.mocked(safeRequest).mock.calls.map(call => call[0])).toEqual([
    `https://${s.allowedDomains[0]}/robots.txt`, `https://${s.allowedDomains[0]}/robots.txt`, s.baseUrl]);
  expect(waitForOfficialRequest).toHaveBeenCalledWith(2000);
});

it("retries a transient document once without skipping its robots check", async () => {
  const s = source();
  vi.mocked(safeRequest).mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(504))
    .mockResolvedValueOnce(response(200, "recovered"));
  expect((await fetchOfficialResource(s.baseUrl, s)).body.toString()).toBe("recovered");
  expect(safeRequest).toHaveBeenCalledTimes(3);
  expect(vi.mocked(safeRequest).mock.calls.slice(1).every(call => call[0] === s.baseUrl)).toBe(true);
});

it("stops after the second gateway failure and never reads a document without robots", async () => {
  const s = source(); vi.mocked(safeRequest).mockResolvedValue(response(502));
  await expect(fetchOfficialResource(s.baseUrl, s)).rejects.toThrow("robots.txt");
  expect(safeRequest).toHaveBeenCalledTimes(2);
});

it.each([401, 403, 429, 500])("does not retry or bypass robots status %s", async status => {
  const s = source(); vi.mocked(safeRequest).mockResolvedValue(response(status));
  await expect(fetchOfficialResource(s.baseUrl, s)).rejects.toThrow("robots.txt");
  expect(safeRequest).toHaveBeenCalledTimes(1);
});

it("honors Retry-After by leaving retry to the next scheduled cycle", async () => {
  const s = source();
  vi.mocked(safeRequest).mockResolvedValueOnce(response(404)).mockResolvedValueOnce(response(503, "", { "retry-after": "3600" }));
  await expect(fetchOfficialResource(s.baseUrl, s)).rejects.toThrow("HTTP 503");
  expect(safeRequest).toHaveBeenCalledTimes(2);
});

it("still refuses an explicitly disallowed path", async () => {
  const s = source(); vi.mocked(safeRequest).mockResolvedValue(response(200, "User-agent: *\nDisallow: /open"));
  await expect(fetchOfficialResource(s.baseUrl, s)).rejects.toThrow("bloqueado por robots");
  expect(safeRequest).toHaveBeenCalledTimes(1);
});

it("never retries TLS or DNS errors", async () => {
  const s = source(); vi.mocked(safeRequest).mockRejectedValue(Error("TLS verification failed"));
  await expect(fetchOfficialResource(s.baseUrl, s)).rejects.toThrow("TLS verification failed");
  expect(safeRequest).toHaveBeenCalledTimes(1);
});
