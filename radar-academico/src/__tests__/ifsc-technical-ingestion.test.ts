import { expect, it } from "vitest";
import { normalizeIfscTechnicalCourses, IFSC_TECHNICAL_URL } from "@/lib/ingestion/normalize-ifsc-technical";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "ifsc-technical-courses-2027", name: "IFSC", institutionName: "Instituto Federal de Santa Catarina", institutionAcronym: "IFSC",
  sourceType: "federal_institute", baseUrl: IFSC_TECHNICAL_URL, allowedDomains: ["www.ifsc.edu.br"],
  allowedPathPrefixes: ["/tecnicos"], listingUrls: [IFSC_TECHNICAL_URL], extractionMode: "html",
  audienceScope: ["mixed"], geographicScope: ["Santa Catarina"], categories: ["formacao"], priority: 85, active: true,
};
const html = `<body><p>Edital 05/Deing/2027-1</p><a href="https://sistemadeingresso.ifsc.edu.br/inicio.php">Inscreva-se</a>
<p>28/09 a 22/10/2026 - Período de inscrições para cursos com seleção por prova</p>
<p>28/09 a 06/11/2026 - Período de inscrições para cursos com seleção por sorteio e ordem de inscrição</p>
<section><h2>Cursos</h2><h4>Câmpus Araranguá</h4><p>Seleção por prova:</p><p>
<a href="https://www.ifsc.edu.br/tecnicos-integrados/eletro">Médio Técnico em Eletrotécnica</a> - 36 vagas (matutino) e 18 vagas (vespertino)<br>
<a href="https://www.ifsc.edu.br/tecnicos-subsequentes/eletro">Subsequente em Eletrotécnica</a> - 40 vagas (noturno)</p>
<h4>Câmpus Gaspar</h4><p>Seleção por sorteio:</p><p><a href="https://www.ifsc.edu.br/tecnicos-subsequentes/ambiente">Subsequente em Meio Ambiente</a> - 40 vagas (EaD)</p>
<h4>Câmpus Palhoça Bilíngue</h4><p>Seleção por sorteio:</p><p><a href="https://www.ifsc.edu.br/tecnicos-integrados/libras">Médio Técnico em Serviços e Produtos Bilíngues</a> - 20 vagas - exclusivo para pessoas surdas usuárias de Libras (vespertino)</p></section></body>`;

it("conta curso/campus/modalidade uma vez, preserva restrições e usa o prazo de cada seleção", () => {
  const items = normalizeIfscTechnicalCourses(html, source, new Date("2026-10-14T15:00:00Z"));
  expect(items).toHaveLength(4);
  expect(new Set(items.map((item) => item.title)).size).toBe(4);
  expect(items[0]).toMatchObject({ deadlineAt: "2026-10-22", opportunityStatus: "open", cityName: "Araranguá", stateCode: "SC", categories: ["formacao"] });
  expect(items[1].title).toContain("subsequente");
  expect(items[2]).toMatchObject({ deadlineAt: "2026-11-06", countryCode: null, stateCode: null, cityName: null });
  expect(items[3].cityName).toBeNull();
  expect(items[3].requirementsText).toContain("exclusivo para pessoas surdas");
  expect(publicationIssue(items[0], source, new Date("2026-10-14T15:00:00Z"))).toBeNull();
  expect(normalizeIfscTechnicalCourses(html, source, new Date("2026-10-23T15:00:00Z"))[0].opportunityStatus).toBe("closed");
  expect(normalizeIfscTechnicalCourses(html, source, new Date("2026-09-20T15:00:00Z"))[0].opportunityStatus).toBe("upcoming");
});

it("exige edição, calendário, rota oficial e vagas da oferta", () => {
  expect(normalizeIfscTechnicalCourses(html.replace("05/Deing/2027-1", "05/Deing/2026-1"), source)).toEqual([]);
  expect(normalizeIfscTechnicalCourses(html.replace("sistemadeingresso.ifsc.edu.br", "terceiro.example"), source)).toEqual([]);
  expect(normalizeIfscTechnicalCourses(html.replaceAll(/\d+ vagas/g, "vagas a definir"), source)).toEqual([]);
  expect(normalizeIfscTechnicalCourses(html.replace("Período de inscrições para cursos com seleção por prova", "Calendário a definir"), source)).toEqual([]);
});

it("preserva a qualificação de séries iniciais antes do número de vagas", () => {
  const qualified = html.replace("Subsequente em Meio Ambiente", "Proeja Qualificação Profissional em Produtor de Sucos integrada ao Ensino Fundamental")
    .replace("- 40 vagas (EaD)", "- Séries Iniciais - 40 vagas (noturno)");
  const items = normalizeIfscTechnicalCourses(qualified, source);
  expect(items).toHaveLength(4);
  expect(items[2].requirementsText).toContain("Séries Iniciais");
});
