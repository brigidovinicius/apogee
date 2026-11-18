import { expect, it } from "vitest";
import { FAPESP_LISTING_URL, FAPESP_SOURCE_ID, fapespPostingId } from "@/lib/ingestion/fapesp-source";
import { canonicalOpportunityKey } from "@/lib/ingestion/revision-key";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import { programmeSupplementUrl } from "@/lib/ingestion/programme-catalogue";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: FAPESP_SOURCE_ID, name: "FAPESP", institutionName: "FAPESP", institutionAcronym: "FAPESP",
  sourceType: "government_foundation", baseUrl: FAPESP_LISTING_URL, listingUrls: [FAPESP_LISTING_URL],
  allowedDomains: ["fapesp.br", "www.fapesp.br", "oportunidades.fapesp.br"], allowedPathPrefixes: ["/", "/oportunidades/"],
  extractionMode: "html", audienceScope: ["mixed"], geographicScope: [], categories: ["bolsas"], priority: 95, active: true,
};

it("keeps the same posting identity across the official FAPESP host migration", () => {
  const urls = ["https://fapesp.br/oportunidades/projeto/9715/", "https://www.fapesp.br/oportunidades/projeto/9715/",
    "https://oportunidades.fapesp.br/projeto-renomeado/9715/"];
  expect(urls.map(fapespPostingId)).toEqual(["9715", "9715", "9715"]);
  expect(new Set(urls.map(url => canonicalOpportunityKey(source.id, "Bolsa de PD", url))).size).toBe(1);
  expect(canonicalOpportunityKey(source.id, "Bolsa de PD", urls[0])).not.toBe(
    canonicalOpportunityKey(source.id, "Bolsa de PD", "https://oportunidades.fapesp.br/projeto/9716/"));
  expect(urls.every(url => isOfficialSourceUrl(url, [source]))).toBe(true);
});

it("limits the root-prefix exception to the official listing and individual numeric postings", () => {
  expect(isOfficialSourceUrl(FAPESP_LISTING_URL, [source])).toBe(true);
  for (const url of ["https://fapesp.br/", "https://fapesp.br/bolsas/", "https://oportunidades.fapesp.br/wp-admin/",
    "https://oportunidades.fapesp.br/encerradas/", "https://oportunidades.fapesp.br/projeto/not-an-id/",
    "https://oportunidades.fapesp.br/projeto/9715/?redirect=https://example.org/", "http://oportunidades.fapesp.br/projeto/9715/",
    "https://oportunidades.fapesp.br.attacker.example/projeto/9715/", "https://user@oportunidades.fapesp.br/projeto/9715/"]) {
    expect(isOfficialSourceUrl(url, [source]), url).toBe(false);
    expect(fapespPostingId(url), url).toBeNull();
  }
  expect(isOfficialSourceUrl(FAPESP_LISTING_URL, [{ ...source, active: false }])).toBe(false);
  expect(isOfficialSourceUrl(FAPESP_LISTING_URL, [{ ...source, allowedDomains: ["fapesp.br"] }])).toBe(false);
});

it("uses the two current CAPES articles without widening their article paths", () => {
  expect(programmeSupplementUrl("capes-pdse-22-2026")).toBe(
    "https://www.gov.br/capes/pt-br/assuntos/noticias/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados");
  expect(programmeSupplementUrl("capes-pdai-23-2026")).toBe(
    "https://www.gov.br/capes/pt-br/assuntos/noticias/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro");
});
