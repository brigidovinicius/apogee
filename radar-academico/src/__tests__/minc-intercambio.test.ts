import { expect, it } from "vitest";
import { normalizeMinCIntercambio } from "@/lib/ingestion/normalize-minc-intercambio";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const url = "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/edital-de-intercambio-cultural-circulacao-e-participacao-audiovisual-no-exterior";
const source: OfficialSource = {
  id: "minc-intercambio-audiovisual-2026", name: "MinC", institutionName: "Ministério da Cultura", institutionAcronym: "MinC",
  sourceType: "federal_government", baseUrl: url, allowedDomains: ["www.gov.br"],
  allowedPathPrefixes: ["/cultura/pt-br/assuntos/editais/inscricoes-em-andamento"], listingUrls: [url],
  extractionMode: "html", audienceScope: ["mixed"], geographicScope: ["Brasil"],
  categories: ["intercambios", "bolsas"], priority: 80, active: true,
};
const text = `Edital de Intercâmbio Cultural - Circulação e Participação Audiovisual no Exterior.
Poderão ser beneficiados(as) Pessoas Físicas, estudantes ou profissionais, do segmento audiovisual.
Os recursos serão distribuídos nacionalmente, sendo vedado exceder o limite de 40% por região brasileira.
As inscrições são gratuitas e estarão abertas, em regime de fluxo contínuo, iniciando-se em 15 de junho de 2026 e permanecendo disponíveis até as 18h (dezoito horas) do dia 6 de novembro de 2026, ou até o esgotamento dos recursos disponibilizados, ocasião em que as inscrições serão suspensas.
O Sistema Mapa da Cultura é o sistema a ser, obrigatoriamente, utilizado para inscrição da proposta.`;
const input = { text, url, source };

it("separa prazo máximo de fluxo contínuo e conserva a abrangência nacional", () => {
  const candidate = normalizeMinCIntercambio(input, new Date("2026-10-14T14:00:00Z"));
  expect(candidate).toMatchObject({ deadlineAt: "2026-11-06T18:00:00-03:00", deadlinePrecision: "exact_datetime", opportunityStatus: "open", countryCode: "BR", stateCode: null, cityName: null });
  expect(candidate && publicationIssue(candidate, source, new Date("2026-10-14T14:00:00Z"))).toBeNull();
});

it("retira a publicação quando a página oficial anuncia suspensão ou chega o limite de Brasília", () => {
  const suspended = normalizeMinCIntercambio({ ...input, text: `${text} As inscrições estão suspensas.` }, new Date("2026-10-14T14:00:00Z"));
  expect(suspended?.opportunityStatus).toBe("suspended");
  expect(suspended && publicationIssue(suspended, source, new Date("2026-10-14T14:00:00Z"))).toBe("status_unconfirmed");
  const expired = normalizeMinCIntercambio(input, new Date("2026-11-06T21:00:01Z"));
  expect(expired?.opportunityStatus).toBe("closed");
});

it("falha sem a rota de inscrição, a abrangência ou o prazo explícitos", () => {
  expect(normalizeMinCIntercambio({ ...input, text: text.replace("O Sistema Mapa da Cultura", "Um sistema") })).toBeNull();
  expect(normalizeMinCIntercambio({ ...input, text: text.replace("Os recursos serão distribuídos nacionalmente", "Os recursos terão outra distribuição") })).toBeNull();
  expect(normalizeMinCIntercambio({ ...input, text: text.replace("6 de novembro de 2026", "6 de novembro de 2027") })).toBeNull();
});
