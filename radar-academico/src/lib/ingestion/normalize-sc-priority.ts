import crypto from "node:crypto";
import * as cheerio from "cheerio";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const JOINVILLE_INTERNSHIP_URL = "https://www.joinville.sc.gov.br/eventos/inscricao-processo-seletivo-estagio-remunerado-edital-no-003-2025-sgp/";
export const JOINVILLE_INTERNSHIP_EDICT = "https://sei.joinville.sc.gov.br/sei/publicacoes/controlador_publicacoes.php?acao=publicacao_visualizar&id_documento=10000028574679&id_orgao_publicacao=0";
export const TRT_HACKATHON_URL = "https://trt-sc.my.canva.site/hackathon-udesc-trt";
export const UFSC_AUGM_URL = "https://sinter.ufsc.br/files/2026/09/Edital_11_SINTER_2026_-_Escala_Grado_2027.1.pdf";
export const UFSC_OUTGOING_URL = "https://sinter.ufsc.br/files/2026/04/Edital_2_SINTER_-_Outgoing_2026.2.pdf";

const months: Record<string, string> = { janeiro: "01", fevereiro: "02", março: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
function dateOnly(day: string, month: string, year: string) {
  const iso = `${year.replace(/\s/g, "")}-${months[month.toLowerCase()] ?? month.padStart(2, "0")}-${day.replace(/\s/g, "").padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}
function htmlText(html: string) {
  const $ = cheerio.load(html); $("script,style,noscript,nav,footer").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}
function state(text: string, start: string, deadline: string, now: Date): OpportunityCandidate["opportunityStatus"] {
  if (/inscriç(?:ão|ões).{0,15}(?:suspensas|canceladas)|evento cancelado/i.test(text)) return "suspended";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return /inscriç(?:ão|ões).{0,15}encerradas/i.test(text) || deadline < today ? "closed" : start > today ? "upcoming" : "open";
}
function base(source: OfficialSource, url: string, text: string): OpportunityCandidate {
  return { officialSourceId: source.id, title: source.name, institution: source.institutionName, sourcePageUrl: url,
    applicantType: "mixed", applicationRoute: "direct_application", benefitType: "other", categories: [],
    isCourse: false, nationallyEligible: false, countryCode: null, stateCode: null, cityName: null,
    geographicScopeKind: "unknown", deadlinePrecision: "date_only", opportunityStatus: "unknown", reviewStatus: "needs_information",
    requirementsText: "", amountText: "", evidenceJson: {}, extractionMethod: source.extractionMode,
    contentHash: crypto.createHash("sha256").update(`sc-priority-v1\n${text}`).digest("hex"),
  };
}

export function normalizeJoinvilleInternship(page: string, edict: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== "joinville-paid-internship-003-2025") return [];
  const text = htmlText(page), legal = htmlText(edict);
  const window = /Eletrônicos\s+Joinville Fácil\s+(\d{2})\/(\d{2})\/(20\d{2})\s+até\s+(\d{2})\/(\d{2})\/(20\d{2})/i.exec(text);
  if (!window || !/Processo Seletivo Estágio Remunerado Edital nº 003-2025-SGP/i.test(text) ||
    !page.includes("https://facil.joinville.sc.gov.br") || !/Município de Joinville \(SC\)/i.test(text) ||
    !/Cadastro de Reserva \(CR\) em estágio remunerado/i.test(legal) || !/1,5 \(um vírgula cinco\) salário mínimo/i.test(legal) ||
    !/01 \(um\) salário mínimo/i.test(legal) || !/de forma contínua/i.test(legal) || !/residir no Estado de Santa Catarina/i.test(legal)) return [];
  const start = dateOnly(window[1], window[2], window[3]), deadlineAt = dateOnly(window[4], window[5], window[6]);
  if (!start || !deadlineAt || deadlineAt < start) return [];
  const status = state(text, start, deadlineAt, now);
  const legalEvidence = { source_url: JOINVILLE_INTERNSHIP_EDICT, excerpt: "Cadastro de Reserva (CR) em estágio remunerado; bolsa mensal de 1 ou 1,5 salário mínimo conforme carga horária; residente no Estado de Santa Catarina." };
  return [{ ...base(source, JOINVILLE_INTERNSHIP_URL, `${text}\n${legal}`),
    title: "Estágio remunerado da Prefeitura de Joinville — edital 003/2025", applicantType: "undergraduate_student",
    applicationRoute: "direct_student_application", applicationUrl: "https://facil.joinville.sc.gov.br/",
    benefitType: "internship", categories: ["carreira"], countryCode: "BR", stateCode: "SC", cityName: "Joinville",
    deadlineAt, opportunityStatus: status,
    requirementsText: "Cadastro de reserva, sem garantia de convocação. Para residentes em Santa Catarina, a partir de 16 anos, matriculados em curso superior de instituição conveniada. Cursos e limites de semestre estão no edital. Não exercer cargo na Prefeitura nem atividade remunerada em outros entes públicos. Candidatura pelo Joinville Fácil.",
    amountText: "Bolsa mensal de 1 salário mínimo para 4h/dia ou 1,5 salário mínimo para 6h/dia, mais vale-transporte e seguro, conforme edital. Remuneração condicionada à convocação e admissão.",
    evidenceJson: {
      deadline_at: { source_url: JOINVILLE_INTERNSHIP_URL, excerpt: window[0] },
      opportunity_status: { source_url: JOINVILLE_INTERNSHIP_URL, excerpt: `Inscreva-se. ${window[0]}` },
      requirements: legalEvidence, amount: legalEvidence,
      location: { source_url: JOINVILLE_INTERNSHIP_URL, excerpt: "Estágio remunerado na administração direta e indireta do Município de Joinville (SC)." },
    },
  }];
}

// The organizer's public website embeds its text nodes as JSON inside a script.
// Parse individual JSON strings; never execute scripts, bootstrap tokens or external assets.
export function officialHackathonText(html: string) {
  const nodes: { order: number; value: string }[] = [];
  const pattern = /"(?:div|b|strong|a|span|p|h[1-6]|canva-inline-text)-(\d+)":\{"A\?":"O","A":\{"A":\{"A\?":"A","A":("(?:[^"\\]|\\.)*")\}/g;
  for (const match of html.matchAll(pattern)) {
    if (nodes.length >= 2000) throw new Error("Limite de texto do evento excedido");
    try { const value: unknown = JSON.parse(match[2]); if (typeof value === "string") nodes.push({ order: Number(match[1]), value }); } catch { throw new Error("Texto do evento inválido"); }
  }
  return nodes.sort((a, b) => a.order - b.order).map((node) => node.value).join(" ").replace(/\s+/g, " ").trim().slice(0, 30_000);
}

export function normalizeTrtHackathon(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (source.id !== "trt-udesc-hackathon-2026") return [];
  const text = officialHackathonText(html);
  const deadline = /Inscrições abertas até dia (\d{2})\/(\d{2})\/(20\d{2})/i.exec(text);
  const starts = /As inscrições abrem em (\d{1,2}) de (\p{L}+) de (20\d{2}), às 12h/iu.exec(text);
  const event = /DATA\s+(\d{2}) de (\p{L}+) de (20\d{2})\s+HORÁRIO\s+Das (\d{1,2})h às (\d{1,2})h/iu.exec(text);
  const requirements = /Pessoas a partir de 16 anos, de qualquer área.*?termo de autorização do responsável legal\./i.exec(text);
  const prize = /Premiação R\$ 13\.000/i.exec(text);
  if (!deadline || !starts || !event || !requirements || !prize || !/Quero Participar/i.test(text) ||
    !/TRT-12.{0,25}UDESC/i.test(text) || !/60 vagas, preenchidas por ordem de inscrição/i.test(text) ||
    !/A participação é gratuita\./i.test(text) || !/Joinville\/SC/.test(text)) return [];
  const deadlineAt = dateOnly(deadline[1], deadline[2], deadline[3]), start = dateOnly(starts[1], starts[2], starts[3]);
  const eventDay = dateOnly(event[1], event[2], event[3]);
  if (!deadlineAt || !start || !eventDay || start > deadlineAt || deadlineAt > eventDay || event[3] !== "2026" || Number(event[4]) > 23) return [];
  return [{ ...base(source, TRT_HACKATHON_URL, text), title: "Hackathon Tecnologia contra o Tráfico de Pessoas — TRT-SC/UDESC 2026",
    applicationUrl: TRT_HACKATHON_URL, categories: ["competicoes", "eventos"], benefitType: "prize",
    countryCode: "BR", stateCode: "SC", cityName: "Joinville", deadlineAt,
    eventStartsAt: `${eventDay}T${event[4].padStart(2, "0")}:00:00-03:00`, opportunityStatus: state(text, start, deadlineAt, now),
    requirementsText: "Participação gratuita, a partir de 16 anos, sem formação acadêmica específica ou obrigação de saber programar. Menores de 18 anos precisam de autorização do responsável. Inscrição individual ou em equipe; 60 vagas por ordem de inscrição. Levar notebook, carregador e documento com foto. Evento no Connect — Ágora Tech Park, Joinville/SC.",
    amountText: "R$ 13.000 de premiação total, distribuída conforme o edital entre as equipes vencedoras. O valor não é remuneração garantida a cada participante.",
    evidenceJson: {
      deadline_at: { source_url: TRT_HACKATHON_URL, excerpt: deadline[0] },
      opportunity_status: { source_url: TRT_HACKATHON_URL, excerpt: `${starts[0]}; ${deadline[0]}; 60 vagas por ordem de inscrição.` },
      event_start: { source_url: TRT_HACKATHON_URL, excerpt: event[0] },
      requirements: { source_url: TRT_HACKATHON_URL, excerpt: requirements[0] },
      amount: { source_url: TRT_HACKATHON_URL, excerpt: prize[0] },
      location: { source_url: TRT_HACKATHON_URL, excerpt: "Connect — Ágora Tech Park (UDESC), Joinville/SC" },
    },
  }];
}

export function normalizeUfscExchange(input: { text: string; url: string; source: OfficialSource }, now = new Date()): OpportunityCandidate | null {
  const { source, url } = input; const text = input.text.replace(/\s+/g, " ").trim();
  if (!/UNIVERSIDADE FEDERAL DE SANTA CATARINA/i.test(text)) return null;
  if (source.id === "ufsc-augm-grado-2027-1" && url === UFSC_AUGM_URL) {
    const window = /no período de\s+(\d(?:\s*\d)?)\s+de\s+(\p{L}+)\s+a\s+(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(20\d{2})/iu.exec(text);
    const requirements = /Ter completado pelo menos 30%.*?nível B1 \(intermediário\)/i.exec(text);
    const support = /Isenção de taxas acadêmicas na universidade de destino/i.exec(text);
    if (!window || !requirements || !support || !/EDITAL Nº 11\/2026\/SINTER/i.test(text) || !/1\s*º SEMESTRE DE 202\s*7/i.test(text) ||
      !/11 \(onze\) vagas/i.test(text) || !/https:\/\/caufsc\.sistemas\.ufsc\.br\//.test(text) || !/Bolsa para auxílio no custeio às despesas de hospedagem e alimentação/i.test(text)) return null;
    const start = dateOnly(window[1], window[2], window[5]), deadlineAt = dateOnly(window[3], window[4], window[5]);
    if (!start || !deadlineAt || start > deadlineAt) return null;
    return { ...base(source, url, text), title: "Intercâmbio UFSC/AUGM Escala Grado — 2027.1", applicantType: "undergraduate_student",
      applicationRoute: "application_via_university", applicationUrl: "https://caufsc.sistemas.ufsc.br/",
      categories: ["bolsas", "intercambios"], benefitType: "mobility_aid", deadlineAt, opportunityStatus: state(text, start, deadlineAt, now),
      requirementsText: "Estudantes de graduação da UFSC, de todos os cursos, com pelo menos 30% da carga horária concluída, IAA mínimo igual à média do curso e espanhol B1. Não ter participado de mobilidade administrada pela SINTER com bolsa. Há 11 vagas para Argentina, Chile, Colômbia e Uruguai; cada candidato escolhe uma instituição. Reservas e documentos obrigatórios estão no edital.",
      amountText: "Isenção de taxas acadêmicas; auxílio UFSC de R$ 1.000 a R$ 2.000 conforme destino; hospedagem e alimentação ou apoio financeiro oferecidos pela universidade anfitriã, segundo suas condições.",
      evidenceJson: { deadline_at: { source_url: url, excerpt: window[0] }, opportunity_status: { source_url: url, excerpt: `Abertura de inscrições; ${window[0]}; 11 vagas.` },
        requirements: { source_url: url, excerpt: requirements[0].slice(0, 1500) }, amount: { source_url: url, excerpt: `${support[0]}; auxílio financeiro UFSC; bolsa para hospedagem e alimentação.` } },
    };
  }
  if (source.id === "ufsc-outgoing-2027-1" && url === UFSC_OUTGOING_URL) {
    // The official PDF breaks this sentence across pages, inserting footer "1".
    const window = /1º de agosto a (\d{1,2}) de (\p{L}+)(?:\s+\d{1,2})?\s+de (20\d{2})\s+\(Intercâmbio em 2027\.1\)/iu.exec(text);
    const requirements = /Ter pelo menos 30% da carga horária do curso concluída.*?40% no semestre de realização intercâmbio/i.exec(text);
    const support = /O Programa não contempla auxílio financeiro para os estudantes, mas implica na isenção de taxas acadêmicas na instituição de destino\./i.exec(text);
    if (!window || !requirements || !support || !/EDITAL Nº 2\/SINTER\/2026/i.test(text) || !/https:\/\/sinter\.ufsc\.br\/informacoes-para-intercambio\//.test(text)) return null;
    const deadlineAt = dateOnly(window[1], window[2], window[3]), start = `${window[3]}-08-01`;
    if (!deadlineAt || start > deadlineAt) return null;
    return { ...base(source, url, text), title: "Intercâmbio UFSC Outgoing — 2027.1", applicantType: "undergraduate_student",
      applicationRoute: "application_via_university", applicationUrl: "https://sinter.ufsc.br/informacoes-para-intercambio/",
      categories: ["intercambios"], deadlineAt, opportunityStatus: state(text, start, deadlineAt, now),
      requirementsText: "Estudantes de graduação da UFSC com matrícula regular, pelo menos 30% da carga horária concluída na inscrição e 40% no semestre de intercâmbio, bom rendimento e autorização da coordenação. O prazo específico de cada destino pode ser anterior ao encerramento do sistema UFSC; enviar os documentos à SINTER com no mínimo 30 dias de antecedência do prazo de nomeação da instituição pretendida. Consulte idiomas, documentos e demais regras do edital.",
      amountText: "Isenção de taxas acadêmicas na instituição de destino. O programa não oferece auxílio financeiro; eventuais taxas de matrícula e despesas pessoais precisam ser verificadas pelo candidato.",
      evidenceJson: { deadline_at: { source_url: url, excerpt: `${window[0]}; cumprir também os prazos de nomeação da instituição de destino.` },
        opportunity_status: { source_url: url, excerpt: `Sistema de Inscrições on-line da UFSC estará aberto: ${window[0]}` },
        requirements: { source_url: url, excerpt: requirements[0] }, amount: { source_url: url, excerpt: support[0] } },
    };
  }
  return null;
}
