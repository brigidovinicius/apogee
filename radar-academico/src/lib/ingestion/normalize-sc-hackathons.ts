import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { eventHasNotStarted } from "./event-start";
import { confirmedTerminalStatus } from "./publication";
import { detectDeadline } from "./detect-deadline";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const NIAVI_ID = "niavi-starttech-2026";
export const NIAVI_URL = "https://www.niavistart.tech/";
export const ORION_ID = "orion-hackathon-october-2026";
export const ORION_URL = "https://www.orionparque.com/2026/09/15/inscricoes-abertas-para-o-hackathorion-maratona-de-inovacao-retorna-em-outubro-para-conectar-talentos-e-desafios-reais/";
export const isScHackathon = (id: string) => [NIAVI_ID, ORION_ID].includes(id);

/** Two individually audited editions. Never follow registration links or count seats/teams. */
export function normalizeScHackathon(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (!isScHackathon(source.id)) return [];
  const niavi = source.id === NIAVI_ID, url = niavi ? NIAVI_URL : ORION_URL;
  const $ = cheerio.load(html), heading = $("h1").text().replace(/\s+/g," ").trim();
  if (niavi ? !/^StartTech 2026$/.test(heading) : !heading.includes("Inscrições abertas para o HackathOrion")) throw new Error("Página da edição indisponível");
  $("script,style,noscript,nav,footer,header").remove();
  const region = niavi ? ($("main").length ? $("main") : $("body")) : $("article");
  const text = region.text().replace(/\s+/g," ").trim();
  if (text.length < 800) throw new Error("Conteúdo parcial da edição");
  const title = niavi ? "StartTech NIAVI — Hackathon 2026" : "HackathOrion — outubro 2026";
  const terminal = confirmedTerminalStatus(text, title);
  const start = niavi ? "2026-10-24" : "2026-10-16";
  const identity = niavi
    ? /24 de outubro de 2026/.test(text) && /NIAVI/.test(text) && /ACIRS/.test(text) && /Rio do Sul\/SC/.test(text) && /banca/.test(text)
    : /16 e 17 de outubro de 2026/.test(text) && /Centro Regional de Inovação de Lages/.test(text) && /Realização\s*Orion Parque Tecnológico/.test(text);
  if (!identity) throw new Error("Identidade ou data da edição mudou");
  if (!terminal && niavi && (!/alunos do ensino médio/i.test(text) || !/15 a 18 anos/.test(text) ||
    !/lista de espera/.test(text) || !/autorização do responsável/.test(text) || !/alimentação/.test(text) || !/kit/i.test(text))) {
    throw new Error("Requisitos ou benefícios da edição mudaram");
  }
  const applicationUrl = niavi ? `${NIAVI_URL}inscricao` : "https://www.sympla.com.br/evento/hackathorion-2026-outubro/3578928";
  const cta = region.find("a[href]").toArray().some(node => {
    try { return new URL($(node).attr("href")!, url).href === applicationUrl && /inscrev|garanta a sua vaga/i.test($(node).text()); }
    catch { return false; }
  });
  const seats = niavi ? /(\d+)\s*confirmados\s*Restam\s*(\d+)\s*vagas/i.exec(text) : null;
  if (niavi && (!seats || Number(seats[1])+Number(seats[2])!==100)) throw new Error("Disponibilidade sem comprovação");
  const open = /[Ii]nscrições abertas/.test(text) && cta && (!niavi || Number(seats![2])>0);
  const status = terminal ?? (eventHasNotStarted(start, now) && open ? "open" : "closed");
  if (!terminal && !/gratuit[ao]/i.test(text)) throw new Error("Condições de participação sem comprovação");
  // A new explicitly stated registration deadline needs a new audit, never overwrite with the event date.
  const deadline = detectDeadline(text);
  if (!terminal && (deadline.stated || deadline.precision !== "not_informed")) throw new Error("Prazo de inscrição exige auditoria");
  const proof = (excerpt: string) => ({ source_url: url, excerpt });
  const requirements = niavi
    ? "Hackathon para estudantes do ensino médio; preferência de 15 a 18 anos e prioridade para escolas públicas de Rio do Sul. Não é preciso saber programar. Menores precisam de autorização do responsável; estudantes de escolas particulares entram em lista de espera. Local: ACIRS, Rio do Sul/SC, em 24/10/2026, a partir de 07h30 anunciadas. Deslocamento por conta do participante. Banco de talentos opcional não é vaga de estágio."
    : "Maratona em 16 e 17/10/2026 no Orion Parque Tecnológico, Centro Regional de Inovação de Lages/SC. Para estudantes técnicos/superiores, desenvolvedores, designers, empreendedores e interessados; programação não é requisito. Idade mínima não informada na página. Consulte as condições de inscrição na edição oficial.";
  return [{ officialSourceId:source.id,title,institution:source.institutionName,sourcePageUrl:url,applicationUrl,
    applicantType:niavi ? "high_school_student" : "mixed",applicationRoute:"direct_application",benefitType:"other",
    categories:["competicoes","eventos"],isCourse:false,nationallyEligible:false,countryCode:"BR",stateCode:"SC",
    cityName:niavi ? "Rio do Sul" : "Lages",geographicScopeKind:"city",deadlinePrecision:"not_informed",eventStartsAt:start,
    opportunityStatus:status,reviewStatus:"needs_information",extractionMethod:"html",requirementsText:requirements,
    amountText:niavi ? "Participação gratuita, kit e alimentação incluídos. Premiação anunciada sem valor financeiro confirmado. Transporte não incluído." : "Inscrições gratuitas e vagas limitadas. Premiação financeira não comprovada; não presumir remuneração.",
    evidenceJson:{event_start:proof(niavi ? "24 de outubro de 2026, a partir das 07h30; Rio do Sul/SC." : "16 e 17 de outubro de 2026, Centro Regional de Inovação de Lages."),
      registration_availability:proof(open ? `Inscrições abertas; chamada de inscrição da edição. ${niavi ? seats![0] : "Vagas limitadas."}` : "Inscrição encerrada, indisponível ou edição iniciada."),
      opportunity_status:proof(terminal ?? (open ? "Inscrições abertas na página oficial da edição." : "Inscrição indisponível ou edição iniciada.")),
      location:proof(niavi ? "ACIRS, Rio do Sul/SC." : "Orion Parque Tecnológico, Lages, Santa Catarina; Brasil.")},
    contentHash:crypto.createHash("sha256").update(`${source.id}\n${text}`).digest("hex") }];
}
