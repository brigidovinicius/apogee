import { expect, it } from "vitest";
import { categoriesFromContext } from "@/lib/ingestion/categories";
const classify = (title: string, patch = {}) => categoriesFromContext({ title, text: "Inscrições abertas para participantes e equipes.",
  sourceCategories: ["eventos", "inovação", "competições", "extensão"], benefitType: "other", isCourse: false, ...patch });
it("combines title, registration and audited source topics without making a cash prize", () => {
  expect(classify("Hackathon universitário 2027")).toEqual(["competicoes", "eventos"]);
  expect(classify("Conferência de tecnologia")).toEqual(["eventos"]);
  expect(classify("Projeto de empreendedorismo estudantil")).toEqual(["pesquisa"]);
  expect(classify("Programa de aceleração de startups")).toEqual(["pesquisa"]);
});
it("does not turn training, incidental mentions, unrelated sources or absent participation into events", () => {
  for (const title of ["Curso sobre hackathons", "Como organizar eventos", "Pesquisa sobre competições", "Bolsa de mestrado", "Vestibular 2027"]) expect(classify(title)).toEqual([]);
  expect(classify("Hackathon universitário", { sourceCategories: ["cursos livres"] })).toEqual([]);
  expect(classify("Hackathon universitário", { text: "Notícia institucional do ano passado." })).toEqual([]);
  expect(classify("Curso sobre inovação", { isCourse: true })).toEqual(["formacao"]);
});

it("generic normalization accepts a conference discovered on an audited source without classifying a course about it", async () => {
  const { normalizeOpportunity } = await import("@/lib/ingestion/normalize-opportunity");
  const source = { id: "official-events", name: "Eventos oficiais", institutionName: "Universidade", categories: ["eventos"], geographicScope: ["Brasil"], extractionMode: "html", location: {} } as import("@/lib/ingestion/types").OfficialSource;
  const input = { title: "Conferência de tecnologia", text: "Inscrições abertas para estudantes até 30/10/2099 pelo formulário de inscrição. Participantes devem cadastrar a candidatura diretamente.", url: "https://example.edu/conferencia", source };
  expect(normalizeOpportunity(input)?.categories).toEqual(["eventos"]);
});
