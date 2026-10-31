import { afterEach, expect, it, vi } from "vitest";
import type { OfficialSource } from "@/lib/ingestion/types";
import type { DiscoveryTarget } from "@/lib/discovery/watchlist";

vi.mock("@/lib/discovery/watchlist", () => ({ claimDueDiscoveryTargets: vi.fn(), completeDiscoveryTarget: vi.fn(), saveDiscoveryLeads: vi.fn(), recordDiscoveryObservation: vi.fn(), recordDiscoveryObservationChanged: vi.fn() }));
vi.mock("@/lib/ingestion/official-source-registry", () => ({ loadActiveOfficialSources: vi.fn() }));
vi.mock("@/lib/ingestion/fetch-source", () => ({ fetchOfficialResource: vi.fn() }));

import { claimDueDiscoveryTargets, completeDiscoveryTarget, saveDiscoveryLeads } from "@/lib/discovery/watchlist";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { candidateUrl, discoveryLinks, runScheduledDiscovery } from "@/lib/discovery/daily-discovery";

const target: DiscoveryTarget = {
  id: "official-events", name: "Official events", organizer: "Institution", kind: "event_series",
  official_url: "https://events.example.org/", topics: ["tecnologia"], priority: 1, enabled: true,
  official_verified_at: new Date(), official_verified_url: "https://events.example.org/", official_review_note: "Official organizer page checked.",
  last_checked_at: null, next_check_at: null, last_status: "not_checked", evidence_url: "https://events.example.org/",
};
const mapped: OfficialSource = {
  id: "mapped", name: "Mapped", institutionName: "Institution", institutionAcronym: "INST",
  sourceType: "official_reference", baseUrl: "https://mapped.example.org/",
  allowedDomains: ["mapped.example.org"], allowedPathPrefixes: ["/"],
  listingUrls: ["https://mapped.example.org/"], extractionMode: "html", audienceScope: [],
  geographicScope: [], categories: [], priority: 1, active: true,
};

afterEach(() => vi.clearAllMocks());

it("collects bounded unmapped leads without fetching their destinations or publishing opportunities", async () => {
  vi.mocked(claimDueDiscoveryTargets).mockResolvedValue([target]);
  vi.mocked(loadActiveOfficialSources).mockResolvedValue([mapped]);
  vi.mocked(fetchOfficialResource).mockResolvedValue({
    body: Buffer.from(`<main>
      <a href="https://new.example.org/hackathon?utm_source=feed">Inscrições hackathon 2026</a>
      <a href="https://mapped.example.org/bolsa">Edital de bolsa</a>
      <a href="http://unsafe.example.org/edital">Edital de pesquisa</a>
      <a href="https://new.example.org/hackathon?utm_source=other">Inscrições hackathon 2026</a>
      <a href="https://events.example.org/@@search?SearchableText=abertas">#abertas</a>
      <a href="https://new.example.org/about">Saiba mais</a><p>Inscrições em programas</p>
    </main>`), contentType: "text/html", hash: "fixture", cached: false,
  });
  vi.mocked(saveDiscoveryLeads).mockResolvedValue(1);
  const result = await runScheduledDiscovery();
  expect(fetchOfficialResource).toHaveBeenCalledExactlyOnceWith(target.official_url, expect.any(Object), 2 * 1024 * 1024);
  expect(saveDiscoveryLeads).toHaveBeenCalledWith(target.id, [{
    url: "https://new.example.org/hackathon", title: "Inscrições hackathon 2026", excerpt: expect.any(String),
  }]);
  expect(completeDiscoveryTarget).toHaveBeenCalledWith(target.id, "checked");
  expect(result).toMatchObject({ targetsChecked: 1, newLeads: 1 });
});

it("blocks unsafe URLs and leaves failed pages unpublished", async () => {
  expect(candidateUrl("http://events.example.org/edital")).toBeNull();
  expect(candidateUrl("https://127.0.0.1/edital")).toBeNull();
  expect(discoveryLinks('<a href="https://new.example.org/curso">Curso gratuito de tecnologia</a>', target, [])).toHaveLength(1);
  expect(discoveryLinks('<a href="https://new.example.org/about">Saiba mais</a><p>Inscrições abertas para programa</p>', target, [])).toHaveLength(0);
  vi.mocked(claimDueDiscoveryTargets).mockResolvedValue([target]);
  vi.mocked(loadActiveOfficialSources).mockResolvedValue([]);
  vi.mocked(fetchOfficialResource).mockRejectedValue(new Error("robots.txt bloqueou"));
  expect(await runScheduledDiscovery()).toMatchObject({ targetsChecked: 1, newLeads: 0 });
  expect(saveDiscoveryLeads).not.toHaveBeenCalled();
  expect(completeDiscoveryTarget).toHaveBeenCalledWith(target.id, "blocked");
});

it("does not fill the review queue with navigation while retaining concrete calls", () => {
  const html=`<header><a href="/cursos/">Cursos de formação</a></header>
    <aside><a href="/inscricao/">Inscrições para eventos</a></aside>
    <main><a href="/chamadas/analise-em-andamento">Próximo »</a>
    <a href="/chamadas/abertas">CHAMADAS ABERTAS</a>
    <a href="/cursos">Cursos</a>
    <a href="/chamadas/produtividade-33-2026">Chamada 33/2026 — Bolsas de Produtividade</a></main>`;
  expect(discoveryLinks(html,target,[])).toEqual([expect.objectContaining({
    url:"https://events.example.org/chamadas/produtividade-33-2026",
  })]);
});

it("discovers future academic Luma events from public JSON-LD even when card anchors are blank", () => {
 const html = '<script type="application/ld+json">'+JSON.stringify({"@type":"ItemList",itemListElement:[
  {"@type":"ListItem",item:{"@type":"Event",url:"https://luma.com/new-builders",name:"Builders Day",startDate:"2099-11-01T09:00:00-03:00",eventStatus:"https://schema.org/EventScheduled"}},
  {"@type":"ListItem",item:{"@type":"Event",url:"https://luma.com/past-hack",name:"Hackathon anterior",startDate:"2020-11-01T09:00:00-03:00",eventStatus:"https://schema.org/EventScheduled"}},
  {"@type":"ListItem",item:{"@type":"Event",url:"https://127.0.0.1/private",name:"Hackathon inseguro",startDate:"2099-11-01T09:00:00-03:00",eventStatus:"https://schema.org/EventScheduled"}}
 ]})+'</script>';
 expect(discoveryLinks(html,target,[])).toEqual([expect.objectContaining({url:"https://luma.com/new-builders"})]);
 expect(discoveryLinks('<a href="/edicao-2027">Olimpíada de Astronomia 2027</a>',target,[])).toHaveLength(1);
});

it("retains a future concrete HTML link when optional JSON-LD status is missing", () => {
 const html='<a href="https://luma.com/future-hack">Hackathon futuro</a><script type="application/ld+json">'+JSON.stringify({'@type':'Event',url:'https://luma.com/future-hack',name:'Hackathon futuro',startDate:'2099-11-01T09:00:00-03:00'})+'</script>';
 expect(discoveryLinks(html,target,[])).toHaveLength(1);
});
