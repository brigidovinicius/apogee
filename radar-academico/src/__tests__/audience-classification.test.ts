import { expect, it } from "vitest";
import { classifyAudience } from "@/lib/ingestion/classify-audience";
import { normalizeOpportunity } from "@/lib/ingestion/normalize-opportunity";
import type { OfficialSource } from "@/lib/ingestion/types";

it.each([
  ["Curso de eletricista: comissionamento e startup de sistemas elétricos. Requisito: ensino médio completo. Estudantes recebem auxílio.", "mixed"],
  ["Curso oferecido por universidades em parceria com empresas para estudantes.", "mixed"],
  ["Chamada para startups. Inscrições abertas.", "company"],
  ["Empresas podem participar da seleção.", "company"],
  ["Edital destinado a instituições de pesquisa.", "institution"],
  ["Bolsa para estudantes de graduação.", "undergraduate_student"],
  ["Auxílio para estudantes do ensino médio.", "high_school_student"],
  ["Bolsas para alunos de mestrado e doutorandos.", "postgraduate_student"],
  ["Vagas para alunos de graduação e estudantes de mestrado.", "mixed"],
  ["Chamada para pesquisadores. Professores podem participar.", "mixed"],
  ["Premiação para pesquisadores com inscrições até outubro.", "researcher"],
])("classifica somente público explícito: %s", (text, expected) => {
  expect(classifyAudience(text)).toBe(expected);
});

it("não transforma escolaridade concluída em matrícula nem declara ausência de dados não extraídos", () => {
  const source: OfficialSource = {
    id: "if-test", name: "Instituto", institutionName: "Instituto", institutionAcronym: "IF",
    sourceType: "federal_institute", baseUrl: "https://example.edu.br/", allowedDomains: ["example.edu.br"],
    allowedPathPrefixes: ["/"], listingUrls: [], extractionMode: "html", audienceScope: ["mixed"],
    geographicScope: [], categories: [], priority: 1, active: true,
  };
  const result = normalizeOpportunity({ source, title: "Curso gratuito de eletricista", url: "https://example.edu.br/curso",
    text: "Inscrições abertas até 23/10/2099 pelo formulário de inscrição. Ensino médio completo é requisito. O curso aborda startup de sistemas elétricos. Os estudantes receberão auxílio financeiro." });
  expect(result).toMatchObject({ applicantType: "mixed", isCourse: true, benefitType: "financial_aid", opportunityStatus: "open" });
  expect(result?.requirementsText).toBe("Consulte a fonte oficial para os requisitos de participação.");
  expect(result?.amountText).toBe("Consulte a fonte oficial para os valores e condições do benefício.");
});
