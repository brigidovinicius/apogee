import { expect, it } from "vitest";
import { IFC_COURSES_URL, normalizeIfcIntegratedCourses } from "@/lib/ingestion/normalize-ifc-integrated";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const source: OfficialSource = {
  id: "ifc-integrated-technical-2027", name: "IFC", institutionName: "Instituto Federal Catarinense", institutionAcronym: "IFC",
  sourceType: "federal_institute", baseUrl: "https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/",
  allowedDomains: ["ingresso.ifc.edu.br"], allowedPathPrefixes: ["/seletivos/processo-seletivo-2027/integrados/"],
  listingUrls: [IFC_COURSES_URL], extractionMode: "html", audienceScope: ["high_school_student"],
  geographicScope: ["Santa Catarina"], categories: ["formacao"], priority: 85, active: true,
};
const courses = `<div class="entry-content"><h2 class="cursos-campus-title">Blumenau</h2><div class="cursos-cards-grid">
<div class="curso-card"><button class="curso-card-header"><span>Informática</span></button><div><ul>
<li>Turmas: 2</li><li>Vagas: 70</li><li>Forma de seleção: Exame de Classificação</li></ul></div></div>
<div class="curso-card"><button class="curso-card-header"><span>Mecatrônica</span></button><div><ul>
<li>Turmas: 1</li><li>Vagas: 35</li><li>Forma de seleção: Exame de Classificação</li></ul></div></div>
</div></div>`;
const application = `<div class="entry-content">Acesse candidato.ifc.edu.br para fazer sua inscrição.
Inscrições até 26 de outubro de 2026. Valor da Taxa de Inscrição*R$ 50,00</div>`;

it("cria uma ficha por curso/campus, sem multiplicar turmas ou vagas, com prazo e taxa comprovados", () => {
  const items = normalizeIfcIntegratedCourses(courses, application, source, new Date("2026-10-14T15:00:00Z"));
  expect(items).toHaveLength(2);
  expect(items.map((item) => item.title)).toEqual([
    "Técnico integrado em Informática — IFC Blumenau 2027",
    "Técnico integrado em Mecatrônica — IFC Blumenau 2027",
  ]);
  expect(items[0]).toMatchObject({ stateCode: "SC", cityName: "Blumenau", categories: ["formacao"], deadlineAt: "2026-10-26", opportunityStatus: "open" });
  expect(items[0].amountText).toContain("R$ 50,00");
  expect(publicationIssue(items[0], source, new Date("2026-10-14T15:00:00Z"))).toBeNull();
  expect(normalizeIfcIntegratedCourses(courses, application, source, new Date("2026-10-27T15:00:00Z"))[0].opportunityStatus).toBe("closed");
});

it("bloqueia publicação se a inscrição, taxa ou vagas não forem verificáveis na fonte oficial", () => {
  expect(normalizeIfcIntegratedCourses(courses, application.replace("Acesse candidato.ifc.edu.br", "Consulte o portal"), source)).toEqual([]);
  expect(normalizeIfcIntegratedCourses(courses, application.replace("R$ 50,00", "a definir"), source)).toEqual([]);
  expect(normalizeIfcIntegratedCourses(courses.replaceAll(/Vagas: \d+/g, "Vagas: a definir"), application, source)).toEqual([]);
});
