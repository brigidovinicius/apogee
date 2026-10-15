import { expect, it } from "vitest";
import { normalizeCapesPdse, capesPdseTerminalEvidence } from "@/lib/ingestion/normalize-capes-pdse";
import { publicationIssue } from "@/lib/ingestion/publication";
import { pdseSource, pdseProgramme, pdseNews } from "./fixtures/capes-pdse";
const normalize = (p = pdseProgramme, n = pdseNews, now = new Date("2026-10-15T00:40:00Z")) => normalizeCapesPdse(p, n, pdseSource, now);
it("publica uma janela futura nacional sem confundir a etapa institucional ou início do intercâmbio", () => {
  const [item] = normalize();
  expect(normalize()).toHaveLength(1);
  expect(item).toMatchObject({ opportunityStatus: "upcoming", deadlineAt: "2026-11-18T17:00:00-03:00", deadlinePrecision: "exact_datetime",
    applicationRoute: "application_via_university", categories: ["bolsas", "intercambios", "pesquisa"], countryCode: null, stateCode: null, cityName: null });
  expect(item.requirementsText).toContain("16/10/2026"); expect(item.requirementsText).toContain("20/10/2026");
  expect(item.amountText).toContain("mínimo 4"); expect(item.amountText).not.toContain("R$");
  expect(item).not.toHaveProperty("applicationUrl"); expect(publicationIssue(item, pdseSource, new Date("2026-10-15T01:00:00Z"))).toBeNull();
});
it("muda de futura para aberta pela data brasileira e retira ao vencer o limite exato", () => {
  expect(normalize(undefined, undefined, new Date("2026-10-20T02:59:00Z"))[0].opportunityStatus).toBe("upcoming");
  expect(normalize(undefined, undefined, new Date("2026-10-20T03:00:00Z"))[0].opportunityStatus).toBe("open");
  expect(normalize(undefined, undefined, new Date("2026-11-18T20:00:01Z"))).toEqual([]);
});
it("recusa edição, critérios, datas ou fusos contraditórios", () => {
  for (const p of [pdseProgramme.replace("18 de novembro", "19 de novembro"), pdseProgramme.replace("16 de outubro", "15 de outubro"),
    pdseProgramme.replace("2026", "2027"), pdseProgramme.replace("horário de Brasília", "horário local"),
    pdseProgramme.replace("homologada pela Pró-Reitoria", "sem seleção prévia")]) expect(normalize(p)).toEqual([]);
  expect(normalize(undefined, pdseNews.replace("</div>", "<p>de 20 de outubro a 18 de novembro de 2026, até as 18h (horário de Brasília)</p></div>"))).toEqual([]);
  expect(normalize(undefined, pdseNews.replace("</div>", "<p>Seleção interna pelas IES: até 17 de outubro de 2026</p></div>"))).toEqual([]);
});
it("preserva diante de página parcial e reconhece prova terminal na fonte exata", () => {
  expect(() => normalize('<div id="page-document"><h1>Programa de Doutorado-sanduíche no Exterior (PDSE)</h1></div>')).toThrow();
  const closed = pdseNews.replace("</div>", "<p>Inscrições suspensas.</p></div>");
  expect(normalize(undefined, closed)).toEqual([]);
  expect(capesPdseTerminalEvidence(pdseProgramme, closed)).toMatchObject({ status: "suspended", evidence: { excerpt: expect.stringContaining("Inscrições suspensas") } });
  const internalClosed = pdseNews.replace("</div>", "<p>Inscrições internas encerradas.</p></div>");
  expect(normalize(undefined, internalClosed)).toHaveLength(1);
  expect(capesPdseTerminalEvidence(pdseProgramme, internalClosed)).toBeNull();
});
