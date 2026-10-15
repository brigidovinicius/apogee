import crypto from "node:crypto";
import { readCapesPage, capesDateOnly } from "./capes-page";
import { confirmedTerminalStatus } from "./publication";
import type { FieldEvidence, OfficialSource, OpportunityCandidate } from "./types";

export const PDSE_SOURCE_ID = "capes-pdse-22-2026";
export const PDSE_URL = "https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/bolsas-e-auxilios-internacionais/encontre-aqui/paises/multinacional/programa-de-doutorado-sanduiche-no-exterior-pdse";
export const PDSE_NEWS_URL = "https://www.gov.br/capes/pt-br/assuntos/noticias-defeso-eleitoral/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados";

function pages(programmeHtml: string, newsHtml: string) {
  return {
    programme: readCapesPage(programmeHtml, /^Programa de Doutorado-sanduíche no Exterior \(PDSE\)$/),
    news: readCapesPage(newsHtml, /^Doutorado Sanduíche no Exterior tem prazos e critérios de seleção alterados$/),
  };
}

export function capesPdseTerminalEvidence(programmeHtml: string, newsHtml: string): { status: OpportunityCandidate["opportunityStatus"]; evidence: FieldEvidence } | null {
  const { programme, news } = pages(programmeHtml, newsHtml);
  for (const [text, url] of [[programme.text.split("Documentos vigentes")[0], PDSE_URL], [news.text, PDSE_NEWS_URL]]) {
    // A local institutional phase can end while selected candidates still have
    // a future national window. Only a notice about the remaining call closes it.
    const national = text.replace(/(?:inscriç(?:ão|ões)|seleç(?:ão|ões))\s+interna(?:s)?\s+(?:(?:nas?|pelas?|das?)\s+IES\s+)?(?:(?:foram|estão|foi|está)\s+)?(?:encerrad[ao]s?|finalizad[ao]s?)\b/gi, "");
    const status = confirmedTerminalStatus(national);
    if (!status) continue;
    const index = Math.max(0, national.search(/(?:inscriç(?:ão|ões)|edital|chamada).{0,80}(?:cancelad|revogad|suspens|suspendid|encerrad|finalizad)|vagas.{0,20}esgotad|prazo.{0,20}encerrad/i));
    return { status, evidence: { source_url: url, excerpt: national.slice(Math.max(0, index - 80), index + 500) } };
  }
  return null;
}

function window(text: string) {
  const all = [...text.matchAll(/de (\d{1,2}) de (\p{L}+) a (\d{1,2}) de (\p{L}+) de (20\d{2}),? até (?:as|às) (\d{1,2})h(?:([0-5]\d))? \(horário de Brasília\)/giu)];
  const parsed = all.map((m) => {
    const start = capesDateOnly(`${m[1]} de ${m[2]} de ${m[5]}`), end = capesDateOnly(`${m[3]} de ${m[4]} de ${m[5]}`);
    return start && end && start <= end && m[5] === "2026" && Number(m[6]) < 24
      ? { start, deadline: `${end}T${m[6].padStart(2, "0")}:${m[7] ?? "00"}:00-03:00`, excerpt: m[0] } : null;
  });
  if (!parsed.length || parsed.some((p) => !p) || new Set(parsed.map((p) => `${p?.start}|${p?.deadline}`)).size !== 1) return null;
  return parsed[0];
}

export function normalizeCapesPdse(programmeHtml: string, newsHtml: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== PDSE_SOURCE_ID) return [];
  const { programme, news } = pages(programmeHtml, newsHtml);
  const current = programme.text.split("Documentos vigentes")[0];
  if (capesPdseTerminalEvidence(programmeHtml, newsHtml)) return [];
  if (!programme.page.find("table").length || programme.page.find("p").length < 2 || news.page.find("p").length < 2 || news.text.length < 250) throw new Error("Conteúdo PDSE parcial ou indisponível");
  const edition = programme.page.find("a").toArray().some((a) => /Edital nº 22\/2026.*Programa Institucional de Doutorado Sanduíche no Exterior/i.test(programme.$(a).text()));
  if (!edition || !/Edital nº\s*22\/2026/i.test(news.text) || !/cursos de Doutorado reconhecidos pela CAPES/i.test(current) ||
      !/A IES fará seleção e, se aprovado, o candidato deverá fazer a inscrição online no site da CAPES/i.test(current) ||
      !/homologada pela Pró-Reitoria/i.test(current)) return [];
  const rows = programme.page.find("table tr").toArray().map((r) => programme.$(r).find("td,th").toArray().map((c) => programme.$(c).text().replace(/\s+/g, " ").trim()));
  const application = rows.filter((r) => /^Inscrição das candidaturas no sistema da CAPES/i.test(r[0] ?? ""));
  const internal = rows.filter((r) => /^Seleção interna \(nas IES\) dos candidatos$/i.test(r[0] ?? ""));
  if (application.length !== 1 || internal.length !== 1) return [];
  const primary = window(application[0][1] ?? ""), rectification = window(news.text);
  const internalDate = capesDateOnly(internal[0][1] ?? "");
  const noticeInternal = [...news.text.matchAll(/Seleção interna pelas IES:\s*até (\d{1,2} de \p{L}+ de 20\d{2})/giu)];
  if (!primary || !rectification || primary.start !== rectification.start || primary.deadline !== rectification.deadline ||
      !internalDate?.startsWith("2026-") || !noticeInternal.length || noticeInternal.some((n) => capesDateOnly(n[1]) !== internalDate) || internalDate > primary.start) return [];
  if (Date.parse(primary.deadline) < now.getTime()) return [];
  const benefits = /Benefícios:\s*(.*?)\s*Duração:/i.exec(current)?.[1];
  const duration = /Duração:\s*mínimo 4 \(quatro\) meses e no máximo 9 \(nove\) meses/i.exec(current);
  if (!benefits || !duration || !/Mensalidade/i.test(benefits) || !/Auxílio deslocamento/i.test(benefits) ||
      !/Auxílio instalação/i.test(benefits) || !/Auxílio seguro-saúde/i.test(benefits) || !/Adicional localidade, quando for o caso/i.test(benefits)) return [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const evidence = (source_url: string, excerpt: string) => ({ source_url, excerpt });
  return [{ officialSourceId: source.id, title: "PDSE CAPES — doutorado-sanduíche (Edital 22/2026)",
    institution: "Coordenação de Aperfeiçoamento de Pessoal de Nível Superior (CAPES)", sourcePageUrl: PDSE_URL,
    applicantType: "postgraduate_student", applicationRoute: "application_via_university", benefitType: "mobility_aid",
    categories: ["bolsas", "intercambios", "pesquisa"], isCourse: false, nationallyEligible: false,
    geographicScopeKind: "unknown", countryCode: null, stateCode: null, cityName: null,
    deadlineAt: primary.deadline, deadlinePrecision: "exact_datetime", opportunityStatus: today < primary.start ? "upcoming" : "open",
    requirementsText: `Doutorandos de cursos reconhecidos pela CAPES, com proposta de pesquisa e seleção prévia pelo PPG/IES. A seleção interna deve ser concluída até ${internalDate.split("-").reverse().join("/")}; consulte imediatamente o prazo local, que pode ser anterior. Etapa nacional CAPES de ${primary.start.split("-").reverse().join("/")} até ${primary.deadline.slice(0, 10).split("-").reverse().join("/")}, às ${primary.deadline.slice(11, 16)} de Brasília, para candidatos selecionados e sujeitos à homologação. Verificar cotas e regras para programas em rede/CAPES-Global.edu no Edital 22/2026.`,
    amountText: `${benefits.trim().replace(/\.$/, "")}. ${duration[0]}. Valores e condições conforme o regulamento e o edital.`,
    reviewStatus: "needs_information", extractionMethod: source.extractionMode,
    evidenceJson: { deadline_at: evidence(PDSE_NEWS_URL, rectification.excerpt), opportunity_status: evidence(PDSE_NEWS_URL, rectification.excerpt),
      internal_selection: evidence(PDSE_URL, internal[0].join(": ")), application_route: evidence(PDSE_URL, "A IES fará seleção e, se aprovado, o candidato deverá fazer a inscrição online no site da CAPES; homologada pela Pró-Reitoria."),
      requirements: evidence(PDSE_URL, "Cursos de Doutorado reconhecidos pela CAPES; proposta de pesquisa e processo seletivo interno em sua Instituição."),
      amount: evidence(PDSE_URL, `${benefits}; ${duration[0]}`) },
    contentHash: crypto.createHash("sha256").update(`capes-pdse-22-2026-v1\n${current}\n${news.text}`).digest("hex"),
  }];
}
