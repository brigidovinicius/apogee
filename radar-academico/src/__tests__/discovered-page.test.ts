import { expect, it } from "vitest";
import { normalizeDiscoveredPage } from "@/lib/ingestion/discovered-page";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "auto-page-fixture", name: "Nova oportunidade", institutionName: "Organizador oficial", institutionAcronym: "",
  sourceType: "official_reference", baseUrl: "https://official.example.org/call", allowedDomains: ["official.example.org"],
  allowedPathPrefixes: ["/call"], listingUrls: ["https://official.example.org/call"], extractionMode: "html",
  audienceScope: [], geographicScope: [], categories: [], priority: 1, active: true,
};
it("rejects mixed listings and missing application evidence", () => {
  expect(normalizeDiscoveredPage("<article><h1>Bolsa</h1></article><article><h1>Curso</h1></article>", source)).toBeNull();
  expect(normalizeDiscoveredPage("<article><h1>Programa de pesquisa</h1><p>Resultado publicado</p></article>", source)).toBeNull();
});

function luma(organizer = "Organizador oficial", start = "2099-12-01T09:00:00-03:00") {
  return '<button>Register</button><script type="application/ld+json">' + JSON.stringify({
    "@type": "Event", url: "https://luma.com/workshop", name: "Workshop de tecnologia e IA",
    description: "Formação para profissionais. Consulte as condições de participação.",
    eventStatus: "https://schema.org/EventScheduled", startDate: start, endDate: "2099-12-01T12:00:00-03:00",
    organizer: { "@type": "Organization", name: organizer, url: "https://luma.com/organizer" },
    location: { "@type": "Place", address: { addressCountry: "BR", addressRegion: "SP", addressLocality: "São Paulo" } },
    offers: { url: "https://luma.com/workshop", price: 0, priceCurrency: "BRL", availability: "https://schema.org/InStock" },
  }) + '</script>';
}
const lumaSource = { ...source, baseUrl: "https://luma.com/workshop", allowedDomains: ["luma.com"],
  notes: "radar:discovery-page:v1; target=organizer; authority=https://luma.com/organizer",
  allowedPathPrefixes: ["/workshop"], listingUrls: ["https://luma.com/workshop"] };
it("uses the validated organizer identity and current registration evidence for a new Luma event", () => {
  const candidate = normalizeDiscoveredPage(luma(), lumaSource);
  expect(candidate).toMatchObject({ opportunityStatus: "open", institution: "Organizador oficial", stateCode: "SP", cityName: "São Paulo" });
  expect(publicationIssue(candidate!, lumaSource)).toBeNull();
  expect(normalizeDiscoveredPage(luma("Unverified organizer"), lumaSource)).toBeNull();
});
it("does not publish past or sold-out Luma events", () => {
  const candidate = normalizeDiscoveredPage(luma().replace("InStock", "SoldOut"), lumaSource);
  expect(candidate?.opportunityStatus).toBe("closed");
  expect(publicationIssue(candidate!, lumaSource)).toBe("status_unconfirmed");
  expect(publicationIssue(normalizeDiscoveredPage(luma("Organizador oficial", "2000-12-01T09:00:00-03:00"), lumaSource)!, lumaSource))
    .toBe("status_unconfirmed");
});
