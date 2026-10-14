import { expect, it } from "vitest";
import { FULBRIGHT_URL, normalizeFulbright } from "@/lib/ingestion/normalize-fulbright";
import { publicationIssue } from "@/lib/ingestion/publication";

import { fulbrightSource, fulbrightHtml } from "./fixtures/fulbright";
const now = new Date("2026-10-14T23:30:00Z");

it("publica uma seleção em três categorias sem multiplicar semestres, valores ou vagas", () => {
  const item = normalizeFulbright(fulbrightHtml, FULBRIGHT_URL, fulbrightSource, now)!;
  expect(item).toMatchObject({ deadlineAt: "2026-11-15", deadlinePrecision: "date_only", opportunityStatus: "open",
    categories: ["bolsas", "intercambios", "pesquisa"], countryCode: "US", stateCode: null, cityName: null,
    nationallyEligible: false, applicationUrl: "https://apply.iie.org/fvsp2027" });
  expect(item.requirementsText).toContain("doutorado até 30 de julho de 2016");
  expect(publicationIssue(item, fulbrightSource, now)).toBeNull();
  expect(normalizeFulbright(fulbrightHtml, FULBRIGHT_URL, fulbrightSource, new Date("2026-11-16T15:00:00Z"))?.opportunityStatus).toBe("closed");
});

it("exige edição, prazo válido, candidatura oficial e requisitos antes de publicar", () => {
  for (const html of [
    fulbrightHtml.replace("15 de novembro", "31 de fevereiro"),
    fulbrightHtml.replace("15 de novembro de 2026", "15 de novembro de 2027"),
    fulbrightHtml.replace("https://apply.iie.org/fvsp2027", "https://terceiro.example/form"),
    fulbrightHtml.replace("fluência em inglês", "requisitos desconhecidos"),
    fulbrightHtml.replace("Inscrições abertas até15 de novembro de 2026", "Inscrições em breve"),
    fulbrightHtml.replace("</article>", "Inscrições abertas até16 de novembro de 2026</article>"),
    fulbrightHtml.replace("</article>", "As informações abaixo referem-se ao último edital</article>"),
  ]) expect(normalizeFulbright(html, FULBRIGHT_URL, fulbrightSource, now)).toBeNull();
  expect(normalizeFulbright(fulbrightHtml, FULBRIGHT_URL.replace("fulbright.org.br", "terceiro.example"), fulbrightSource, now)).toBeNull();
});

it("retira avisos terminais com formulário removido, mas preserva evidência diante de indisponibilidade", () => {
  for (const notice of ["Inscrições encerradas", "Chamada suspensa", "Edital revogado"])
    expect(normalizeFulbright(fulbrightHtml.replace("Inscreva-se", notice), FULBRIGHT_URL, fulbrightSource, now)).toBeNull();
  expect(() => normalizeFulbright("<body>Verifying your browser</body>", FULBRIGHT_URL, fulbrightSource, now)).toThrow();
  expect(() => normalizeFulbright(fulbrightHtml.replaceAll("article", "section"), FULBRIGHT_URL, fulbrightSource, now)).toThrow();
});
