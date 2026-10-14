import { expect, it } from "vitest";
import { normalizeFapesp } from "@/lib/ingestion/normalize-fapesp";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "fapesp-open-fellowships", name: "FAPESP", institutionName: "FAPESP", institutionAcronym: "FAPESP",
  sourceType: "government_foundation", baseUrl: "https://fapesp.br/oportunidades/",
  allowedDomains: ["fapesp.br", "www.fapesp.br"], allowedPathPrefixes: ["/oportunidades/"],
  listingUrls: ["https://fapesp.br/oportunidades/"], extractionMode: "html", audienceScope: ["mixed"],
  geographicScope: [], categories: ["bolsas", "pesquisa"], priority: 95, active: true,
};
const input = {
  title: "Bolsa de PD em Lógica Instituição: Unicamp Cidade: Campinas Inscrições até: 15/10/2099",
  text: `FAPESP | Fundo de Amparo à Pesquisa do Estado de São Paulo Bolsa de PD em Lógica
    Título do projeto: Racionalidade e Lógica Project title: Rationality and Logic
    Unidade/Instituição: Universidade Estadual de Campinas Unit/Instituition: University of Campinas
    Data limite para inscrições: 15/10/2099 Deadline for submissions: 2099-10-15
    Localização: Campinas Locale: Campinas
    E-mail para inscrições: bolsas@unicamp.br E-mail for proposal submission: bolsas@unicamp.br`,
  url: "https://fapesp.br/oportunidades/projeto-de-logica/9715/", source,
};

it("exige prazo, projeto e candidatura na própria página oficial, sem inferir UF da cidade", () => {
  const result = normalizeFapesp(input, new Date("2026-10-14T14:00:00Z"));
  expect(result).toMatchObject({ categories: ["bolsas", "pesquisa"], opportunityStatus: "open",
    countryCode: null, stateCode: null, cityName: null });
  expect(result?.evidenceJson.location?.excerpt).toContain("Campinas");
  expect(normalizeFapesp({ ...input, text: input.text.replace("E-mail para inscrições:", "Contato:") })).toBeNull();
  expect(normalizeFapesp({ ...input, text: input.text.replace("Data limite para inscrições:", "Prazo desconhecido:") })).toBeNull();
  expect(normalizeFapesp({ ...input, url: "https://terceiros.example/oportunidades/projeto-de-logica/9715/" })).toBeNull();
  expect(normalizeFapesp(input, new Date("2100-01-01T12:00:00Z"))).toMatchObject({ opportunityStatus: "closed" });
});
