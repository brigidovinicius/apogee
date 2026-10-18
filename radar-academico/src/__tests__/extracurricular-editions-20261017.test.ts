import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeExtracurricularEdition, FGV_DATATHON_ID, FGV_DATATHON_URL, CPS_ROBOCODE_ID, CPS_ROBOCODE_URL,
  IFMG_JECT_ID, IFMG_JECT_URL, AMAZONIA_ID, AMAZONIA_URL, AMAZONIA_DOCUMENT_URL } from "@/lib/ingestion/normalize-extracurricular-20261017";
import { programmeCataloguePageCount, programmeSupplementUrl } from "@/lib/ingestion/programme-catalogue";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const now = new Date("2026-10-17T15:00:00Z");
// Minimal synthetic fixtures exercise actual containers, required facts and CTAs.
const fgv = `<article><h1>7º Desafio de Dados (Datathon) de Moedas Digitais da FGV EESP</h1>
<p>Inscrições: de 22 de setembro a 23 de outubro de 2026.</p><p>Competição on-line: regularmente matriculados em cursos de graduação no Brasil, três a cinco integrantes; Inscrições individuais; até 20 equipes.</p>
<p>A participação é gratuita. 1º lugar: R$ 7.000,00. 2º lugar: R$ 5.000,00. 3º lugar: R$ 3.000,00.</p><p>Abertura do desafio: 30 de outubro de 2026, às 9h (horário de Brasília).</p>
<a href="https://evento.fgv.br/7datathonfgveesp2209/">Inscreva-se</a><p>Calendário: 23/10/2026 09h00 - 23h59</p></article>`;
const cps = `<div class="cps-texto-conteudo__sem-sidebar"><h1>14º Torneio Robocode 2026</h1><p>Alunos de Etecs e Fatecs. Equipes de até 3 integrantes matriculados. Participação em apenas uma equipe por aluno.</p><p>Até 30/10/2026; 01/11 a 30/11/2026. Certificados para todos os participantes e prêmios para os 3 melhores.</p><a href="https://forms.gle/EA5fnqBu8V3qeYqy5">Inscrever Equipe</a></div>`;
const ifmg = `<div class="com-content-article"><h1>XV JECT abre inscrições para participação em programação com mais de 30 atividades</h1><p>IFMG Campus Formiga: inscrições abertas até dia 20 de outubro; 27 a 29 de outubro de 2026.</p><p>Programação diversificada e gratuita; atividades presenciais para o público em geral.</p><a href="https://www.even3.com.br/xvject-758596/?utm_source=official">Inscrições e informações</a></div>`;
const amazonia = `<h1>UniEVANGÉLICA abre inscrições para projeto de extensão e responsabilidade social na Amazônia</h1><p>Edição 2027. Inscrições de 15 a 30 de outubro de 2026. 17 vagas; regularmente matriculados na UniEVANGÉLICA e instituições internacionais. Taxa de alimentação de R$ 500; hospedagem fluvial e terrestre.</p><a href="https://docs.google.com/forms/d/e/1FAIpQLSepO2KvDbz2GZ_chwJUxgS-_lM4xXZb6_s1y5hu0X10ex-bPg/viewform?usp=header">Inscrição</a>`;
const document = `CHAMAMENTO Edição 2027, 15 a 30/10/26, VOLUNTÁRIOS PAGANTES. Taxa de alimentação R$ 500,00. Transporte aéreo; hospedagem fluvial e terrestre. Curso de Medicina 9º e 10ºp; Curso de Odontologia 8ºp; Curso de Enfermagem 8ºp; Curso de Fisioterapia 6ºp; Curso de Psicologia 8ºp; Curso de Teologia 3ºp. Viagem 25 de abril a 1º de maio de 2027.`;
const fixtures = [
  { id: FGV_DATATHON_ID, url: FGV_DATATHON_URL, html: fgv, supplement: "", deadline: "2026-10-23" },
  { id: CPS_ROBOCODE_ID, url: CPS_ROBOCODE_URL, html: cps, supplement: "", deadline: "2026-10-30" },
  { id: IFMG_JECT_ID, url: IFMG_JECT_URL, html: ifmg, supplement: "", deadline: "2026-10-20" },
  { id: AMAZONIA_ID, url: AMAZONIA_URL, html: amazonia, supplement: document, deadline: "2026-10-30" },
];
function source(id: string, url: string): OfficialSource { return { id, active: true, institutionName: "Organização oficial", extractionMode: "html", allowedDomains: [new URL(url).hostname], allowedPathPrefixes: [new URL(url).pathname, new URL(AMAZONIA_DOCUMENT_URL).pathname] } as OfficialSource; }

it.each(fixtures)("publishes exactly one audited edition: $id", f => {
  const s = source(f.id, f.url), result = normalizeExtracurricularEdition(f.html, f.supplement, s, now);
  expect(result).toHaveLength(1); expect(result[0]).toMatchObject({ isCourse: false, deadlineAt: f.deadline, deadlinePrecision: "date_only", opportunityStatus: "open", sourcePageUrl: f.url });
  expect(publicationIssue(result[0], s, now)).toBeNull();
  expect(programmeCataloguePageCount(s.id)).toBe(s.id === AMAZONIA_ID ? 2 : 1);
});
it.each(fixtures)("withdraws closure and lost enrollment for $id", f => {
  const s = source(f.id, f.url);
  const closed = f.html.replace("</h1>", "</h1><p>Inscrições encerradas.</p>");
  expect(normalizeExtracurricularEdition(closed, f.supplement, s, now)[0].opportunityStatus).toBe("closed");
  expect(normalizeExtracurricularEdition(f.html.replace(/href=/g, "data-removed="), f.supplement, s, now)[0].opportunityStatus).toBe("closed");
});
it.each(fixtures)("expires the registration date in Brasilia, never at the event start: $id", f => {
  const s = source(f.id, f.url);
  expect(normalizeExtracurricularEdition(f.html, f.supplement, s, new Date(`${f.deadline}T23:59:59-03:00`))[0].opportunityStatus).toBe("open");
  const after = new Date(`${f.deadline}T23:59:59-03:00`); after.setSeconds(after.getSeconds() + 1);
  expect(normalizeExtracurricularEdition(f.html, f.supplement, s, after)[0].opportunityStatus).toBe("closed");
});
it("keeps FGV eligibility national, awards per team and the explicit event timezone", () => {
  const item = normalizeExtracurricularEdition(fgv, "", source(FGV_DATATHON_ID, FGV_DATATHON_URL), now)[0];
  expect(item).toMatchObject({ nationallyEligible: true, stateCode: null, cityName: null, eventStartsAt: "2026-10-30T09:00:00-03:00", deadlinePrecision: "date_only" });
  expect(item.amountText).toContain("para a equipe"); expect(item.amountText).toContain("Participação gratuita");
  expect(() => normalizeExtracurricularEdition(fgv.replace("7.000,00", "8.000,00"), "", source(FGV_DATATHON_ID, FGV_DATATHON_URL), now)).toThrow();
});
it("does not broaden CPS students to national eligibility or invent money", () => {
  const item = normalizeExtracurricularEdition(cps, "", source(CPS_ROBOCODE_ID, CPS_ROBOCODE_URL), now)[0];
  expect(item).toMatchObject({ nationallyEligible: false, stateCode: "SP", cityName: null });
  expect(item.amountText).not.toMatch(/R\$/); expect(item.requirementsText).toContain("Etecs e Fatecs");
});
it("requires the complete current Amazonia document and keeps lodging separate from costs", () => {
  const s = source(AMAZONIA_ID, AMAZONIA_URL);
  expect(programmeSupplementUrl(s.id)).toBe(AMAZONIA_DOCUMENT_URL);
  for (const pdf of ["", document.replace("500,00", "600,00"), document.replace("15 a 30/10/26", "15 a 31/10/26"), document.replace("Curso de Medicina 9º e 10ºp", "Curso de Medicina 7ºp")]) {
    expect(() => normalizeExtracurricularEdition(amazonia, pdf, s, now)).toThrow();
  }
  const item = normalizeExtracurricularEdition(amazonia, document, s, now)[0];
  expect(item).toMatchObject({ nationallyEligible: false, stateCode: null, cityName: null, countryCode: null, officialDocumentUrl: AMAZONIA_DOCUMENT_URL });
  expect(item.amountText).toContain("Taxa de alimentação: R$ 500,00"); expect(item.amountText).toContain("sem bolsa em dinheiro anunciada");
  expect(item.requirementsText).toContain("Voluntários pagantes"); expect(item.requirementsText).toContain("9º/10º");
});
it("rejects partial pages, changed editions and deadlines without using menus as evidence", () => {
  for (const f of fixtures) expect(() => normalizeExtracurricularEdition("<h1>Manutenção</h1>", f.supplement, source(f.id, f.url), now)).toThrow();
  expect(() => normalizeExtracurricularEdition(fgv.replace("7º Desafio", "8º Desafio"), "", source(FGV_DATATHON_ID, FGV_DATATHON_URL), now)).toThrow();
  expect(() => normalizeExtracurricularEdition(ifmg.replace("20 de outubro", "21 de outubro"), "", source(IFMG_JECT_ID, IFMG_JECT_URL), now)).toThrow();
  expect(normalizeExtracurricularEdition(fgv, "", source("unregistered", FGV_DATATHON_URL), now)).toEqual([]);
});
it("stages only the four audited sources inactive and does not mutate existing sources", () => {
  const sql = readFileSync(new URL("../../db/migrations/0036_audited_extracurricular_editions.sql", import.meta.url), "utf8");
  expect(sql).toContain("85,false,'verified'"); expect(sql).not.toMatch(/\b(?:update|delete|drop|alter)\s/i);
  for (const f of fixtures) expect(sql).toContain(`'${f.id}'`);
});
