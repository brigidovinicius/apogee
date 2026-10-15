import crypto from "node:crypto";
import { readCapesPage, capesDateOnly } from "./capes-page";
import { confirmedTerminalStatus } from "./publication";
import type { FieldEvidence, OfficialSource, OpportunityCandidate } from "./types";

export const PDAI_SOURCE_ID = "capes-pdai-23-2026";
export const PDAI_URL = "https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai";
export const PDAI_NEWS_URL = "https://www.gov.br/capes/pt-br/assuntos/noticias-defeso-eleitoral/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro";

export function capesPdaiTerminalEvidence(programmeHtml: string, newsHtml: string): { status: OpportunityCandidate["opportunityStatus"]; evidence: FieldEvidence } | null {
  const programme = readCapesPage(programmeHtml, /^Programa de Desenvolvimento Acadêmico Indígena \(PDAI\)$/);
  const news = readCapesPage(newsHtml, /^Prazo de inscrição no PDAI é prorrogado até 26 de outubro$/);
  for (const [text, url] of [[programme.text.split("Documentos relacionados")[0], PDAI_URL], [news.text, PDAI_NEWS_URL]]) {
    const status = confirmedTerminalStatus(text);
    if (!status) continue;
    const index = Math.max(0, text.search(/(?:inscriç(?:ão|ões)|edital|chamada).{0,80}(?:cancelad|revogad|suspens|suspendid|encerrad|finalizad)|vagas.{0,20}esgotad|prazo.{0,20}encerrad/i));
    return { status, evidence: { source_url: url, excerpt: text.slice(Math.max(0, index - 80), index + 500) } };
  }
  return null;
}

/** Programme calendar plus its exact official extension notice; never a PDF/form crawl. */
export function normalizeCapesPdai(programmeHtml: string, newsHtml: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== PDAI_SOURCE_ID) return [];
  const programme = readCapesPage(programmeHtml, /^Programa de Desenvolvimento Acadêmico Indígena \(PDAI\)$/);
  const news = readCapesPage(newsHtml, /^Prazo de inscrição no PDAI é prorrogado até 26 de outubro$/);
  const current = programme.text.split("Documentos relacionados")[0];
  if (capesPdaiTerminalEvidence(programmeHtml, newsHtml)) return [];
  // A title-only/shell response is unavailable, not proof that a call vanished.
  if (programme.page.find("table").length < 2 || news.page.find("p").length < 2 || news.text.length < 250) {
    throw new Error("Conteúdo CAPES parcial ou indisponível");
  }
  if (!/Está vigente o Edital CAPES nº\s*23\/2026/i.test(current) || !/Edital Conjunto nº\s*23\/2026/i.test(news.text) ||
      !/exclusivamente pelo sistema eletrônico de inscrição da CAPES/i.test(news.text) ||
      !/formulário eletrônico específico deve ser preenchido diretamente no sistema de inscrição da CAPES/i.test(news.text) ||
      !/Manual de Inscrição do SICAPES/i.test(programme.text) || !/Autodeclaração Indígena/i.test(programme.text) ||
      !/Declaração de Pertencimento Étnico Indígena/i.test(programme.text)) return [];
  const rows = programme.page.find("table tr").toArray().map((row) => programme.$(row).find("td,th").toArray().map((cell) => programme.$(cell).text().replace(/\s+/g, " ").trim()));
  const windows = rows.filter((cells) => /^Inscrições dos candidatos indígenas$/i.test(cells[0] ?? ""));
  if (windows.length !== 1) return [];
  const day = capesDateOnly(windows[0][1] ?? "");
  // The notice supplies the hour/time zone; the current programme supplies its year.
  const notices = [...news.text.matchAll(/até as (\d{1,2})h(\d{2}) do dia (\d{1,2}) de (\p{L}+), no horário de Brasília/giu)];
  const notice = notices[0];
  if (!day?.startsWith("2026-") || !notice || notices.some((n) => Number(n[1]) > 23 || Number(n[2]) > 59 ||
      day !== capesDateOnly(`${n[3]} de ${n[4]} de 2026`)) || new Set(notices.map((n) => `${n[1]}:${n[2]}`)).size !== 1) return [];
  const deadlineAt = `${day}T${notice[1].padStart(2, "0")}:${notice[2]}:00-03:00`;
  if (Date.parse(deadlineAt) < now.getTime()) return [];
  const support = programme.page.find("table").toArray().filter((table) => /Valor mensal/i.test(programme.$(table).text()));
  if (support.length !== 1) return [];
  const awards = programme.$(support[0]).find("tr").toArray().map((row) => programme.$(row).find("td,th").toArray().map((cell) => programme.$(cell).text().replace(/\s+/g, " ").trim()));
  const master = awards.filter((r) => r[0] === "Mestrado"), doctorate = awards.filter((r) => r[0] === "Doutorado");
  if (master.length !== 1 || doctorate.length !== 1 || ![master[0], doctorate[0]].every((r) => /^Até \d+ meses$/.test(r[2]) && /^R\$ [\d.]+,\d{2}$/.test(r[3])) ||
      !/estudantes indígenas na pós-graduação stricto sensu/i.test(current) || !/seleção de Programas de Pós-Graduação participantes/i.test(current)) return [];
  const amount = `Bolsas mensais: mestrado — ${master[0][3]}, ${master[0][2].toLowerCase()}; doutorado — ${doctorate[0][3]}, ${doctorate[0][2].toLowerCase()}. Pagamento direto pela CAPES, após seleção e implementação conforme o edital.`;
  const requirements = "Candidatos indígenas a mestrado ou doutorado em Programas de Pós-Graduação participantes do Edital 23/2026. Preencher o formulário específico no sistema eletrônico da CAPES, conforme o manual SICAPES. A seleção ocorre pelos PPGs em rodadas; consultar a lista oficial de programas, os documentos de pertencimento e autodeclaração indígena e todos os requisitos do edital.";
  const evidence = (source_url: string, excerpt: string) => ({ source_url, excerpt });
  return [{
    officialSourceId: source.id, title: "PDAI CAPES — bolsas de mestrado e doutorado (Edital 23/2026)",
    institution: "Coordenação de Aperfeiçoamento de Pessoal de Nível Superior (CAPES)", sourcePageUrl: PDAI_URL,
    applicantType: "mixed", applicationRoute: "direct_student_application", benefitType: "academic_scholarship",
    categories: ["bolsas", "pesquisa"], isCourse: false, nationallyEligible: false,
    geographicScopeKind: "unknown", countryCode: null, stateCode: null, cityName: null,
    deadlineAt, deadlinePrecision: "exact_datetime", opportunityStatus: "open", requirementsText: requirements, amountText: amount,
    reviewStatus: "needs_information", extractionMethod: source.extractionMode,
    evidenceJson: { deadline_at: evidence(PDAI_NEWS_URL, `${notice[0]}; Edital Conjunto nº 23/2026.`),
      deadline_date: evidence(PDAI_URL, windows[0].join(": ")),
      opportunity_status: evidence(PDAI_NEWS_URL, `Candidaturas exclusivamente pelo sistema eletrônico de inscrição da CAPES; ${notice[0]}.`),
      application_route: evidence(PDAI_NEWS_URL, "O formulário eletrônico específico deve ser preenchido diretamente no sistema de inscrição da CAPES."),
      requirements: evidence(PDAI_URL, "Estudantes indígenas na pós-graduação stricto sensu; seleção de Programas de Pós-Graduação participantes. Edital CAPES nº 23/2026."),
      amount: evidence(PDAI_URL, `Valor mensal: ${master[0].join(" | ")}; ${doctorate[0].join(" | ")}.`) },
    contentHash: crypto.createHash("sha256").update(`capes-pdai-23-2026-v1\n${current}\n${news.text}`).digest("hex"),
  }];
}
