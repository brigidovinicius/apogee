import { afterEach, expect, it, vi } from "vitest";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("@/lib/ingestion/safe-request", async (original) => ({ ...await original<typeof import("@/lib/ingestion/safe-request")>(), safeRequest: vi.fn() }));
import { lookup } from "node:dns/promises";
import { collectBounded, isPublicAddress, publicLookup, safeRequest } from "@/lib/ingestion/safe-request";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { BoundedCache } from "@/lib/ingestion/bounded-cache";
import { sourceSettings, sourceUrls } from "@/lib/ingestion/source-settings";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import type { OfficialSource } from "@/lib/ingestion/types";
const source: OfficialSource = { id: "safe", name: "Source", institutionName: "Institution", institutionAcronym: "INST", sourceType: "federal_university", baseUrl: "https://example.edu.br/", allowedDomains: ["example.edu.br"], allowedPathPrefixes: ["/"], listingUrls: [], extractionMode: "html", audienceScope: ["mixed"], geographicScope: [], categories: [], priority: 1, active: true };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.100.100.200", "0.0.0.0", "198.18.1.1", "224.0.0.1", "255.255.255.255", "::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "fc00::1", "fe80::1", "64:ff9b::a00:1", "2002:7f00:1::", "2001:db8::1", "garbage"])("blocks nonglobal IP %s", (ip) => expect(isPublicAddress(ip)).toBe(false));
it("accepts only public unicast addresses", () => {
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  expect(isPublicAddress("2606:4700:4700::1111")).toBe(true);
});
it("DNS mixed answer is rejected; validated answer is passed to the socket callback", async () => {
  vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }] as never);
  const mixed = await new Promise<unknown[]>((resolve) => publicLookup("example.edu.br", {}, (...args) => resolve(args)));
  expect(mixed[0]).toBeInstanceOf(Error);
  vi.mocked(lookup).mockResolvedValue([{ address: "8.8.8.8", family: 4 }] as never);
  const good = await new Promise<unknown[]>((resolve) => publicLookup("example.edu.br", {}, (...args) => resolve(args)));
  expect(good).toEqual([null, "8.8.8.8", 4]);
});
it("stream overflow stops reading instead of buffering remaining chunks", async () => {
  let yielded = 0; let closed = false;
  async function* stream() { try { for (let i = 0; i < 100; i++) { yielded++; yield new Uint8Array(4); } } finally { closed = true; } }
  await expect(collectBounded(stream(), 5)).rejects.toThrow("limite");
  expect(yielded).toBe(2); expect(closed).toBe(true);
});
it("redirect chains are capped and each hop respects the allowlist", async () => {
  vi.stubEnv("INGESTION_REQUEST_DELAY_MS", "100");
  let requests = 0;
  vi.mocked(safeRequest).mockImplementation(async (url) => {
    if (url.endsWith("/robots.txt")) return new Response("User-agent: *\nAllow: /");
    requests++;
    return new Response(null, { status: 302, headers: { location: `/hop-${requests}` } });
  });
  await expect(fetchOfficialResource("https://example.edu.br/start", source)).rejects.toThrow("Limite");
  expect(requests).toBe(6);
  vi.mocked(safeRequest).mockImplementation(async (url) => url.endsWith("/robots.txt") ? new Response("") : new Response(null, { status: 302, headers: { location: "https://evil.example/" } }));
  await expect(fetchOfficialResource("https://example.edu.br/external", source)).rejects.toThrow("registro");
});
it("304 uses a bounded cached body and retains MIME type", async () => {
  vi.stubEnv("INGESTION_REQUEST_DELAY_MS", "100");
  let fetched = false;
  vi.mocked(safeRequest).mockImplementation(async (url, headers) => {
    if (url.endsWith("/robots.txt")) return new Response("");
    if (fetched) { expect(headers["If-None-Match"]).toBe('"fixture"'); return new Response(null, { status: 304 }); }
    fetched = true;
    return new Response("<rss/>", { headers: { etag: '"fixture"', "content-type": "application/rss+xml" } });
  });
  const first = await fetchOfficialResource("https://example.edu.br/cached", source);
  const second = await fetchOfficialResource("https://example.edu.br/cached", source);
  expect(second.cached).toBe(true); expect(second.contentType).toBe("application/rss+xml"); expect(second.hash).toBe(first.hash);
});
it("robots errors fail closed before resource fetch", async () => {
  vi.mocked(safeRequest).mockResolvedValue(new Response(null, { status: 503 }));
  await expect(fetchOfficialResource("https://example.edu.br/robots-error", source)).rejects.toThrow("robots");
});
it("cache limits both entries and bytes, and expires values", () => {
  const cache = new BoundedCache<string>(2, 5, 100);
  cache.set("a", "a", 3, 0); cache.set("b", "b", 3, 1);
  expect(cache.get("a", 2)).toBeUndefined(); expect(cache.get("b", 2)).toBe("b");
  cache.set("c", "c", 6, 3); expect(cache.get("c", 4)).toBeUndefined();
  expect(cache.get("b", 102)).toBeUndefined();
});
it("rejects invalid source enum, interval, domain and listing origin", () => {
  const form = new FormData(); form.set("id", "safe"); form.set("domains", "example.edu.br"); form.set("interval", "24"); form.set("mode", "html");
  expect(sourceSettings(form).interval).toBe(24);
  for (const value of ["NaN", "Infinity", "1", "2.5", "721"]) { form.set("interval", value); expect(() => sourceSettings(form)).toThrow(); }
  form.set("interval", "24"); form.set("mode", "arbitrary"); expect(() => sourceSettings(form)).toThrow();
  expect(() => sourceUrls("https://evil.example/listing", ["example.edu.br"])).toThrow();
  expect(() => sourceUrls("https://user:pass@example.edu.br/listing", ["example.edu.br"])).toThrow();
  expect(isOfficialSourceUrl("https://example.edu.br:8443/", [source])).toBe(false);
});
