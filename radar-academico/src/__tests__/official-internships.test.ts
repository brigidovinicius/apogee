import { expect, it } from "vitest";
import { normalizeBraskemInternship, normalizeSjcInternship } from "@/lib/ingestion/normalize-internships";
import type { OfficialSource } from "@/lib/ingestion/types";

const source = (id: string, name: string): OfficialSource => ({
  id, name, institutionName: name, institutionAcronym: name,
  sourceType: id.startsWith("sjc") ? "municipal_government" : "corporate_organizer",
  baseUrl: "https://example.org/", allowedDomains: ["example.org"], allowedPathPrefixes: ["/"],
  listingUrls: [], extractionMode: "html", audienceScope: ["mixed"], geographicScope: [],
  categories: ["carreira"], priority: 85, active: true,
});

const sjcUrl = "https://servicos.sjc.sp.gov.br/concurso/concurso_detalhe.aspx?codigo=192";
const sjc = {
  url: sjcUrl, source: source("sjc-open-internships", "Prefeitura de São José dos Campos"),
  text: `PROCESSO SELETIVO PARA ESTÁGIO - ANEXO OUTUBRO Inscrições Abertas
    RESUMO DO CONCURSO 10/2026 - OUTUBRO
    De: De 01/10/2026 00:00 a 15/10/2026 23:59
    O processo seletivo destina-se ao preenchimento de vagas e cadastro reserva para estagiários, para alunos regularmente matriculados. 
    Escolaridade exigida: Ensino técnico e superior. STATUS DO CONCURSO Inscrições Abertas
    As inscrições e provas on-line serão realizadas gratuitamente pelo site do CIEE.
    Remuneração: De R$506,19 a R$1.093,37`,
};
const braskemUrl = "https://www.braskem.com.br/bahia-release/braskem-abre-inscricoes-para-programa-de-estagio-2027-com-mais-de-100-vagas-em-cinco-estados";
const braskem = {
  url: braskemUrl, source: source("braskem-internship-programme", "Braskem"),
  text: `6 de Outubro de 2026 Braskem abre as inscrições para a edição 2027 do seu Programa de Estágio, com a oferta de 120 vagas para estudantes universitários.
    Período de inscrições: 1º a 30 de outubro. As inscrições ficam abertas até 30 de outubro.
    As inscrições são destinadas a estudantes que tenham previsão de conclusão da graduação entre junho de 2028 e dezembro de 2029.
    As oportunidades estão distribuídas pelas unidades da companhia nos estados de Alagoas, Bahia, Rio de Janeiro, Rio Grande do Sul e São Paulo.
    A bolsa-auxílio entre R$ 2.200 e R$ 2.800 é oferecida conforme a vaga.
    Os interessados têm até o dia 30 de outubro para realizar a candidatura por meio da página da iniciativa.`,
};

it("publica somente o edital municipal com inscrição e prazo exatos", () => {
  const item = normalizeSjcInternship(sjc, new Date("2026-10-14T15:00:00Z"));
  expect(item).toMatchObject({ categories: ["carreira"], benefitType: "internship", opportunityStatus: "open",
    deadlineAt: "2026-10-15T23:59:00-03:00", countryCode: null, stateCode: null, cityName: null });
  expect(normalizeSjcInternship(sjc, new Date("2026-10-16T04:00:00Z"))?.opportunityStatus).toBe("closed");
  expect(normalizeSjcInternship({ ...sjc, text: sjc.text.replace("As inscrições e provas on-line", "As provas") })).toBeNull();
  expect(normalizeSjcInternship({ ...sjc, url: "https://terceiro.example/estagio" })).toBeNull();
});

it("conta uma edição da Braskem, não suas 120 vagas ou cinco estados separadamente", () => {
  const item = normalizeBraskemInternship(braskem, new Date("2026-10-14T15:00:00Z"));
  expect(item).toMatchObject({ title: "Programa de Estágio Braskem 2027", categories: ["carreira"],
    deadlineAt: "2026-10-30", opportunityStatus: "open", countryCode: null, stateCode: null, cityName: null });
  expect(item?.evidenceJson.location?.excerpt).toContain("Alagoas, Bahia, Rio de Janeiro, Rio Grande do Sul e São Paulo");
  expect(normalizeBraskemInternship(braskem, new Date("2026-11-01T12:00:00Z"))?.opportunityStatus).toBe("closed");
  expect(normalizeBraskemInternship({ ...braskem, text: braskem.text.replace("candidatura por meio da página da iniciativa", "veja mais") })).toBeNull();
  expect(normalizeBraskemInternship({ ...braskem, url: "https://third-party.example/estagio" })).toBeNull();
});
