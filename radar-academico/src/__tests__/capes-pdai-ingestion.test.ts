import { expect, it } from "vitest";
import { normalizeCapesPdai } from "@/lib/ingestion/normalize-capes-pdai";
import { publicationIssue } from "@/lib/ingestion/publication";
import { pdaiSource, pdaiProgramme, pdaiNews } from "./fixtures/capes-pdai";
const now = new Date("2026-10-14T23:55:00Z");

it("combina calendário e retificação oficiais, contando uma seleção e usando hora/fuso comprovados", () => {
  const items = normalizeCapesPdai(pdaiProgramme, pdaiNews, pdaiSource, now);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ deadlineAt: "2026-10-26T23:59:00-03:00", deadlinePrecision: "exact_datetime",
    categories: ["bolsas", "pesquisa"], countryCode: null, stateCode: null, cityName: null, nationallyEligible: false });
  expect(items[0].amountText).toContain("mestrado — R$ 2.100,00, até 24 meses");
  expect(items[0].amountText).toContain("doutorado — R$ 3.100,00, até 48 meses");
  expect(items[0].requirementsText).toContain("Candidatos indígenas");
  expect(items[0]).not.toHaveProperty("applicationUrl");
  expect(publicationIssue(items[0], pdaiSource, now)).toBeNull();
});

it("recusa conflitos de prazo, fuso ausente, edição diferente, apoio ambíguo e prazo vencido", () => {
  for (const programme of [pdaiProgramme.replace("26 de outubro", "25 de outubro"),
    pdaiProgramme.replace("2026", "2027"), pdaiProgramme.replace("R$ 2.100,00", "a definir"),
    pdaiProgramme.replace("Inscrições dos candidatos indígenas", "Resultado dos candidatos indígenas")])
    expect(normalizeCapesPdai(programme, pdaiNews, pdaiSource, now)).toEqual([]);
  expect(normalizeCapesPdai(pdaiProgramme, pdaiNews.replace("horário de Brasília", "horário local"), pdaiSource, now)).toEqual([]);
  expect(normalizeCapesPdai(pdaiProgramme, pdaiNews.replace("23h59", "25h00"), pdaiSource, now)).toEqual([]);
  expect(normalizeCapesPdai(pdaiProgramme, pdaiNews.replace("</div>", "<p>até as 22h59 do dia 26 de outubro, no horário de Brasília</p></div>"), pdaiSource, now)).toEqual([]);
  expect(normalizeCapesPdai(pdaiProgramme, pdaiNews, pdaiSource, new Date("2026-10-27T02:59:01Z"))).toEqual([]);
  expect(normalizeCapesPdai(pdaiProgramme, pdaiNews.replace("</div>", "<p>Inscrições encerradas</p></div>"), pdaiSource, now)).toEqual([]);
});

it("distingue indisponibilidade de encerramento, sem executar scripts ou herdar a sede da CAPES", () => {
  expect(() => normalizeCapesPdai("<body>Manutenção</body>", pdaiNews, pdaiSource, now)).toThrow();
  expect(() => normalizeCapesPdai(pdaiProgramme, "<body>Desafio</body>", pdaiSource, now)).toThrow();
  expect(() => normalizeCapesPdai(pdaiProgramme, '<div id="page-document"><h1>Prazo de inscrição no PDAI é prorrogado até 26 de outubro</h1></div>', pdaiSource, now)).toThrow();
  expect(normalizeCapesPdai(pdaiProgramme+'<script>throw new Error("never execute")</script>',pdaiNews,pdaiSource,now)).toHaveLength(1);
});
