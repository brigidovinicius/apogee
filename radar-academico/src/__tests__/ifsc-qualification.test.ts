import { expect, it } from "vitest";
import { confirmedTerminalStatus } from "@/lib/ingestion/publication";
import { normalizeIfscQualification } from "@/lib/ingestion/normalize-ifsc-qualification";
import type { OfficialSource } from "@/lib/ingestion/types";
const source = { id: "ifsc-qualification-courses-2026-2", institutionName: "IFSC" } as OfficialSource;
const html = `<body><div class="journal-content-article"><h2>Edital</h2>Edital Deing 24/2026/2; Edital Deing 27/2026/2.
  <p>7 a 27/10/2026 - Período de inscrições</p><a href="https://sistemadeingresso.ifsc.edu.br/">Inscreva-se</a>
  </div><p>Não há cobrança de taxa de inscrição. Você pode fazer um curso gratuito.</p>
  <div class="journal-content-article"><h2>Cursos de qualificação profissional</h2>
    <p><a>Câmpus São Carlos</a></p><p><strong>Seleção por sorteio:</strong><br>QGIS - 20 vagas (noturno)</p>
    <p><strong>Seleção por ordem de inscrição:</strong><br>Jogos de Tabuleiro - 20 vagas (matutino) e 20 vagas (vespertino)</p></div>
  <div class="journal-content-article"><h2>Cursos de Idiomas</h2><p><a>Câmpus Urupema</a></p>
    <p><strong>Seleção por ordem de inscrição:</strong><br>Inglês - 40 vagas (EaD)</p></div></body>`;
const now = new Date("2026-10-14T15:00:00Z");
it("keeps one programme per course/campus, consolidates shifts and preserves unknown geography/requirements", () => {
  const rows = normalizeIfscQualification(html, source, now);expect(rows).toHaveLength(3);
  expect(rows.every(r => r.opportunityStatus === "open" && r.deadlineAt === "2026-10-27")).toBe(true);
  expect(rows.every(r => r.countryCode === null && r.stateCode === null && r.cityName === null)).toBe(true);
  expect(rows.find(r => r.title.includes("Jogos"))?.requirementsText).toContain("20 vagas (matutino) e 20 vagas (vespertino)");
  expect(rows.find(r => r.title.includes("Inglês"))?.requirementsText).toContain("EaD");
  expect(normalizeIfscQualification(html, source, new Date("2026-10-28T03:00:00Z")).every(r => r.opportunityStatus === "closed")).toBe(true);
});
it("rejects invalid envelopes/editions and does not close other courses when one fills", () => {
  for (const changed of [html.replace("27/10", "32/10"), html.replace("7 a 27/10/2026", "7 a 27/10/2027"), html.replace("curso gratuito", "curso"), "Manutenção"]) {
    expect(() => normalizeIfscQualification(changed, source, now)).toThrow();
  }
  const rows = normalizeIfscQualification(html.replace("QGIS - 20 vagas (noturno)", "QGIS - 20 vagas (noturno); vagas esgotadas"), source, now);
  expect(rows.find(r => r.title.includes("QGIS"))?.opportunityStatus).toBe("closed");
  expect(rows.filter(r => r.opportunityStatus === "open")).toHaveLength(2);
});

it("withdraws zero availability and ordinary edital notices, without closing remaining course offers", () => {
  const empty = normalizeIfscQualification(html.replace("QGIS - 20 vagas", "QGIS - 0 vagas").replace("Jogos de Tabuleiro - 20 vagas", "Jogos de Tabuleiro - 0 vagas"), source, now);
  expect(empty.find(r => r.title.includes("QGIS"))?.opportunityStatus).toBe("closed");
  expect(empty.find(r => r.title.includes("Jogos"))?.opportunityStatus).toBe("open");
  for (const notice of ["curso cancelado", "turma suspensa"]) {
    const rows = normalizeIfscQualification(html.replace("QGIS - 20 vagas (noturno)", `QGIS - 20 vagas (noturno); ${notice}`), source, now);
    expect(rows.find(r => r.title.includes("QGIS"))?.opportunityStatus).toBe(notice.includes("cancelado") ? "cancelled" : "suspended");
    expect(rows.filter(r => r.opportunityStatus === "open")).toHaveLength(2);
  }
  const suspended = html.replace("<h2>Edital</h2>", "<h2>Edital</h2><p>Inscrições suspensas</p>");
  expect(normalizeIfscQualification(suspended, source, now).every(r => r.opportunityStatus === "suspended")).toBe(true);
  expect(confirmedTerminalStatus("Em caso de cancelamento do curso, consulte o edital.")).toBeNull();
  expect(normalizeIfscQualification(html + "<div>FAQ: em caso de cancelamento do curso, consulte o edital.</div>", source, now).every(r => r.opportunityStatus === "open")).toBe(true);
});
