import crypto from "node:crypto";
import type { OfficialSource, OpportunityCandidate } from "./types";

const pageUrl = "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/edital-de-intercambio-cultural-circulacao-e-participacao-audiovisual-no-exterior";
const months: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function dateParts(day: string, month: string, year: string) {
  const number = months[month.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
  if (!number) return null;
  const iso = `${year}-${String(number).padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

export function normalizeMinCIntercambio(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  if (input.source.id !== "minc-intercambio-audiovisual-2026" || input.url !== pageUrl) return null;
  const text = input.text.replace(/\s+/g, " ").trim();
  if (!/Edital de Intercâmbio Cultural - Circulação e Participação Audiovisual no Exterior/i.test(text) ||
      !/Pessoas Físicas, estudantes ou profissionais, do segmento audiovisual/i.test(text) ||
      !/Os recursos serão distribuídos nacionalmente/i.test(text) ||
      !/Sistema Mapa da Cultura é o sistema a ser, obrigatoriamente, utilizado para inscrição da proposta/i.test(text)) return null;
  const window = /As inscrições são gratuitas e estarão abertas, em regime de fluxo contínuo, iniciando-se em (\d{1,2}) de ([\p{L}]+) de (\d{4}) e permanecendo disponíveis até as (\d{1,2})h(?:\s*\([^)]*\))? do dia (\d{1,2}) de ([\p{L}]+) de (\d{4}), ou até o esgotamento dos recursos disponibilizados/iu.exec(text);
  if (!window || Number(window[4]) > 23) return null;
  const startsOn = dateParts(window[1], window[2], window[3]);
  const closesOn = dateParts(window[5], window[6], window[7]);
  if (!startsOn || !closesOn || startsOn > closesOn || window[7] !== "2026") return null;
  const deadlineAt = `${closesOn}T${window[4].padStart(2, "0")}:00:00-03:00`;
  const startAt = `${startsOn}T00:00:00-03:00`;
  const statusSignal = /inscrições (?:foram|estão|encontram-se|permanecem) (suspensas|encerradas)|edital (?:foi|está) (suspenso|cancelado)/i.exec(text);
  const opportunityStatus = /suspens/i.test(statusSignal?.[0] ?? "") ? "suspended" :
    /cancelad/i.test(statusSignal?.[0] ?? "") ? "cancelled" :
    statusSignal || now.getTime() > Date.parse(deadlineAt) ? "closed" :
    now.getTime() < Date.parse(startAt) ? "upcoming" : "open";
  const excerpt = text.slice(window.index, window.index + window[0].length + 100);
  const evidence = { source_url: input.url, excerpt: excerpt.slice(0, 1000) };
  const national = /Os recursos serão distribuídos nacionalmente[^.]*\./i.exec(text)?.[0] ?? "";
  return {
    officialSourceId: input.source.id,
    title: "Edital de Intercâmbio Cultural MinC 2026 — Audiovisual no Exterior",
    institution: input.source.institutionName,
    sourcePageUrl: input.url,
    applicantType: "mixed",
    applicationRoute: "direct_student_application",
    benefitType: "mobility_aid",
    categories: ["intercambios", "bolsas"],
    isCourse: false,
    nationallyEligible: true,
    geographicScopeKind: "country",
    countryCode: "BR",
    stateCode: null,
    cityName: null,
    deadlineAt,
    deadlinePrecision: "exact_datetime",
    requirementsText: "Pessoas físicas brasileiras, maiores de 18 anos, estudantes ou profissionais do audiovisual, com pelo menos um ano de atuação comprovada. Verifique as condições do item 7.1.3 do edital e a participação em evento elegível no exterior.",
    amountText: "Apoio financeiro para participação em evento do audiovisual no exterior; confira o valor individual no edital.",
    reviewStatus: "needs_information",
    opportunityStatus,
    evidenceJson: {
      deadline_at: evidence,
      opportunity_status: { source_url: input.url, excerpt: statusSignal?.[0] ?? excerpt },
      application_route: { source_url: input.url, excerpt: "O Sistema Mapa da Cultura é o sistema a ser, obrigatoriamente, utilizado para inscrição da proposta." },
      national_scope: { source_url: input.url, excerpt: national },
      requirements: { source_url: input.url, excerpt: "Pessoas Físicas, estudantes ou profissionais, do segmento audiovisual. Os(as) candidatos(as) deverão apresentar as condições de elegibilidade descritas no item 7.1.3 do Edital." },
    },
    extractionMethod: input.source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`minc-intercambio-v1\n${text}`).digest("hex"),
  };
}
