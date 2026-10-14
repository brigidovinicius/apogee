import { expect, it } from "vitest";
import { normalizeNovosValores, NOVOS_VALORES_EDITAL_URL } from "@/lib/ingestion/normalize-novos-valores";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "sed-novos-valores-2026", name: "Novos Valores", institutionName: "Secretaria de Estado da Educação de Santa Catarina", institutionAcronym: "SED-SC",
  sourceType: "state_government", baseUrl: "https://www.sea.sc.gov.br/", allowedDomains: ["www.sea.sc.gov.br"],
  allowedPathPrefixes: ["/wp-content/uploads/2026/02/"], listingUrls: [NOVOS_VALORES_EDITAL_URL],
  extractionMode: "html", audienceScope: ["mixed"], geographicScope: ["Santa Catarina"], categories: ["carreira"], priority: 85, active: true,
};
const text = `EDITAL N° 388 de 13/02/2026 SECRETARIA DE ESTADO DA EDUCAÇÃO - SED
2.1 as inscrições para o programa de Estágio “novos valorEs” estarão abertas a partir da publicação deste Edital e durante todo o ano letivo até 30/11/2026,
2.2 as instituições de Ensino ficarão responsáveis pela inscrição e cadastramento de todos os estudantes interessados
2.3 para efetuar a inscrição, o estudante deverá ser residente no Estado de santa Catarina; ter completado 16 (dezesseis) anos e estar matriculado em curso regular de ensino médio, de educação profissional, de ensino superior, de educação especial
8.1 o valor da bolsa de estágio será de: r$ 380,00 (trezentos e oitenta reais) para estagiários do Ensino Médio; r$ 430,00 (quatrocentos e trinta reais) para estagiários de Educação profissional;
8.2 o estagiário participante receberá auxílio transporte em pecúnia, no valor de r$ 5,00 por dia útil.`;

it("publica uma edição remunerada para ensino médio e técnico com inscrição institucional", () => {
  const item = normalizeNovosValores({ text, url: NOVOS_VALORES_EDITAL_URL, source }, new Date("2026-10-14T15:00:00Z"));
  expect(item).toMatchObject({ deadlineAt: "2026-11-30", opportunityStatus: "open", benefitType: "internship", stateCode: "SC", cityName: null, categories: ["carreira"] });
  expect(item?.amountText).toContain("R$ 380,00");
  expect(publicationIssue(item!, source, new Date("2026-10-14T15:00:00Z"))).toBeNull();
  expect(normalizeNovosValores({ text, url: NOVOS_VALORES_EDITAL_URL, source }, new Date("2026-12-01T15:00:00Z"))?.opportunityStatus).toBe("closed");
});

it("exige prazo, inscrição e remuneração no edital oficial", () => {
  expect(normalizeNovosValores({ text: text.replace("30/11/2026", "a definir"), url: NOVOS_VALORES_EDITAL_URL, source })).toBeNull();
  expect(normalizeNovosValores({ text: text.replace("inscrição e cadastramento", "gestão"), url: NOVOS_VALORES_EDITAL_URL, source })).toBeNull();
  expect(normalizeNovosValores({ text: text.replace("r$ 380,00", "valor a definir"), url: NOVOS_VALORES_EDITAL_URL, source })).toBeNull();
  expect(normalizeNovosValores({ text, url: "https://terceiros.example/edital.pdf", source })).toBeNull();
});
