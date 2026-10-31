import { afterEach, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("@/lib/ingestion/safe-request", async (original) => ({ ...await original<typeof import("@/lib/ingestion/safe-request")>(), safeRequest: vi.fn() }));
import { lookup } from "node:dns/promises";
import { collectBounded, decodeBoundedResponse, isPublicAddress, publicLookup, safeRequest } from "@/lib/ingestion/safe-request";
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
it("keeps gzip disabled by default and bounds both encoded bytes and decoded output", () => {
  const body=Buffer.from("Verified public text");
  const zipped=gzipSync(body);
  expect(()=>decodeBoundedResponse(zipped,"gzip",100)).toThrow("limites");
  expect(decodeBoundedResponse(zipped,"gzip",100,true).toString()).toBe(body.toString());
  expect(()=>decodeBoundedResponse(zipped,"gzip",10,true)).toThrow("limites");
  const bomb=gzipSync(Buffer.alloc(100_000,65));
  expect(bomb.byteLength).toBeLessThan(1000);
  expect(()=>decodeBoundedResponse(bomb,"gzip",1000,true)).toThrow("limites");
  expect(()=>decodeBoundedResponse(zipped,"br",100,true)).toThrow("limites");
  expect(()=>decodeBoundedResponse(Buffer.from("broken"),"gzip",100,true)).toThrow("limites");
});
it("limits the gzip opt-in to the exact audited DAE source, host and path while retaining robots checks",async()=>{
  vi.stubEnv("INGESTION_REQUEST_DELAY_MS","100");
  const url="https://dae.ufsc.br/admissao-por-transferencias-e-retornos-edital/";
  const dae={...source,id:"ufsc-transfers-2027-1",allowedDomains:["dae.ufsc.br","noticias.ufsc.br","other.ufsc.br"]};
  vi.mocked(safeRequest).mockImplementation(async requested=>requested.endsWith("/robots.txt")?new Response(""):new Response("Official public page"));
  await fetchOfficialResource(url,dae);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===true)).toBe(true);
  vi.mocked(safeRequest).mockClear();
  await fetchOfficialResource("https://noticias.ufsc.br/2026/10/ufsc-lanca-edital-de-transferencias-e-retornos-com-5-139-vagas/",dae);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===true)).toBe(true);
  vi.mocked(safeRequest).mockClear();
  await fetchOfficialResource(url,{...dae,id:"another-source"});
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===false)).toBe(true);
  vi.mocked(safeRequest).mockClear();
  await fetchOfficialResource("https://dae.ufsc.br/another-page/",dae);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===false)).toBe(true);
  vi.mocked(safeRequest).mockClear();
  await fetchOfficialResource("https://noticias.ufsc.br/another-page/",dae);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===false)).toBe(true);
  vi.mocked(safeRequest).mockClear();
  await fetchOfficialResource(url.replace("dae.ufsc.br","other.ufsc.br"),dae);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===false)).toBe(true);
  vi.mocked(safeRequest).mockImplementation(async requested=>requested.endsWith("/robots.txt")?new Response("User-agent: *\nDisallow: /"):new Response("Must not read"));
  await expect(fetchOfficialResource(url,dae)).rejects.toThrow("robots");
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
  const form = new FormData(); form.set("id", "safe"); form.set("domains", "example.edu.br"); form.set("listing_urls", "https://example.edu.br/listing"); form.set("audit_evidence_url", "https://example.edu.br/evidence"); form.set("interval", "24"); form.set("mode", "html");
  expect(sourceSettings(form).interval).toBe(24);
  for (const value of ["NaN", "Infinity", "1", "2.5", "721"]) { form.set("interval", value); expect(() => sourceSettings(form)).toThrow(); }
  form.set("interval", "24"); form.set("mode", "arbitrary"); expect(() => sourceSettings(form)).toThrow();
  expect(() => sourceUrls("https://evil.example/listing", ["example.edu.br"])).toThrow();
  expect(() => sourceUrls("https://user:pass@example.edu.br/listing", ["example.edu.br"])).toThrow();
  expect(isOfficialSourceUrl("https://example.edu.br:8443/", [source])).toBe(false);
});

it("EV.G reuses bounded robots briefly, still blocks each disallowed URL and fails closed after expiry", async () => {
 vi.useFakeTimers();vi.stubEnv("INGESTION_USER_AGENT","RadarRobotsCacheTest");vi.stubEnv("INGESTION_REQUEST_DELAY_MS","100");
 const evg={...source,id:"evg-enap-open-courses",allowedDomains:["www.escolavirtual.gov.br"]};let robotsCalls=0,resourceCalls=0;
 vi.mocked(safeRequest).mockImplementation(async url=>{if(url.endsWith("/robots.txt")){robotsCalls++;return new Response("User-agent: *\nDisallow: /admin");}resourceCalls++;return new Response("<html>ok</html>",{headers:{"content-type":"text/html"}});});
 try {
  const first=fetchOfficialResource("https://www.escolavirtual.gov.br/curso/1",evg);await vi.runAllTimersAsync();await first;
  const second=fetchOfficialResource("https://www.escolavirtual.gov.br/curso/2",evg);await vi.runAllTimersAsync();await second;
  expect(robotsCalls).toBe(1);expect(resourceCalls).toBe(2);
  await expect(fetchOfficialResource("https://www.escolavirtual.gov.br/admin",evg)).rejects.toThrow("robots");expect(resourceCalls).toBe(2);
  await vi.advanceTimersByTimeAsync(300_001);vi.mocked(safeRequest).mockResolvedValue(new Response(null,{status:503}));
  await expect(fetchOfficialResource("https://www.escolavirtual.gov.br/curso/3",evg)).rejects.toThrow("robots");
 } finally { vi.useRealTimers(); }
});

it("does not cache EV.G robots when response headers require fresh validation", async () => {
 vi.useFakeTimers();vi.stubEnv("INGESTION_REQUEST_DELAY_MS","100");
 const evg={...source,id:"evg-enap-open-courses",allowedDomains:["www.escolavirtual.gov.br"]};
 try { for(const [index,control] of ["no-store","no-cache","public,max-age=1"].entries()) {
  vi.stubEnv("INGESTION_USER_AGENT",`RadarRobotsHeaderTest${index}`);let robotsCalls=0;
  vi.mocked(safeRequest).mockImplementation(async url=>url.endsWith("/robots.txt")?(robotsCalls++,new Response("User-agent: *\nAllow: /",{headers:{"cache-control":control}})):new Response("<html>ok</html>"));
  for(const id of [1,2]){const run=fetchOfficialResource(`https://www.escolavirtual.gov.br/curso/${id}`,evg);await vi.runAllTimersAsync();await run;}
  expect(robotsCalls).toBe(2);
 } } finally { vi.useRealTimers(); }
});

it("follows the audited CPS canonical redirect but rejects any other path on the same host", async () => {
 vi.stubEnv("INGESTION_REQUEST_DELAY_MS", "100");
 const alias="https://arinter.cps.sp.gov.br/intercambio-cultural-do-centro-paula-souza-abre-inscricoes-para-mais-de-500-bolsas-internacionais-em-2027/";
 const canonical="https://arinter.cps.sp.gov.br/intercambio-cultural-cps-2026/";
 const cps={...source,id:"cps-cultural-15-2026",allowedDomains:["arinter.cps.sp.gov.br"],allowedPathPrefixes:[new URL(alias).pathname,new URL(canonical).pathname]};
 vi.mocked(safeRequest).mockImplementation(async url=>url.endsWith("/robots.txt") ? new Response("") : url===alias ? new Response(null,{status:301,headers:{location:canonical}}) : new Response("Confirmed official programme",{headers:{"content-type":"text/html"}}));
 expect((await fetchOfficialResource(alias,cps)).body.toString()).toBe("Confirmed official programme");
 vi.mocked(safeRequest).mockImplementation(async url=>url.endsWith("/robots.txt") ? new Response("") : new Response(null,{status:301,headers:{location:"https://arinter.cps.sp.gov.br/unaudited/"}}));
 await expect(fetchOfficialResource(alias,cps)).rejects.toThrow("registro oficial");
});

it.each([
 ["exp-olimpiada-brasileira-de-fisiologia","obfis.cienciasecognicao.org"],
 ["exp-olimpiada-brasileira-de-neurociencia-brazilian-brain-bee","brazilianbrainbee.org"],
 ["exp-olimpiada-brasileira-de-neurociencias-para-graduandos","obng.cienciasecognicao.org"],
])("bounds the new gzip compatibility to audited target %s and its exact homepage",async(id,host)=>{
 vi.stubEnv('INGESTION_REQUEST_DELAY_MS','100');
 const s={...source,id,baseUrl:`https://${host}/`,allowedDomains:[host,'other.example.org']};
 vi.mocked(safeRequest).mockImplementation(async requested=>requested.endsWith('/robots.txt')?new Response(''):new Response('Official public page'));
 vi.mocked(safeRequest).mockClear(); await fetchOfficialResource(s.baseUrl,s);
 expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===true)).toBe(true);
 for(const [url,configured] of [[s.baseUrl,{...s,id:'other-source'}],[s.baseUrl+'other-page',s],['https://other.example.org/',s]] as const){
  vi.mocked(safeRequest).mockClear(); await fetchOfficialResource(url,configured);
  expect(vi.mocked(safeRequest).mock.calls.every(call=>call[5]===false)).toBe(true);
 }
 vi.mocked(safeRequest).mockImplementation(async()=>new Response('User-agent: *\nDisallow: /'));
 await expect(fetchOfficialResource(s.baseUrl,s)).rejects.toThrow('robots');
});
