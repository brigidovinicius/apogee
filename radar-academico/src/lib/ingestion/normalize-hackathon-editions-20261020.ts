import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import { eventHasNotStarted } from "./event-start";
import type { OfficialSource, OpportunityCandidate } from "./types";

type Edition = {
 id: string; url: string; title: string; institution: string; checks: string[];
 dynamic: boolean; categories: NonNullable<OpportunityCandidate["categories"]>;
 country: string | null; state: OpportunityCandidate["stateCode"]; city: string | null;
 deadline: string | null; submission: boolean; start: string | null;
 requirements: string; conditions: string; supplement: string | null;
 registrationUrl: string | null; availability: string;
};
/** Audited editions only. Dynamic Kaggle sources are staged INACTIVE until a supported live capture exists. */
export const HACKATHON_EDITIONS: readonly Edition[] = [
  {
    "id": "senac-ms-decola-saude-2026",
    "url": "https://ms.senac.br/decola",
    "title": "Decola Hackathon — Missão Saúde | Dourados 2026",
    "institution": "Senac MS, com HU-UFGD/HU Brasil",
    "checks": [
      "Missão Saúde 2026",
      "29 a 31 de outubro de 2026",
      "02/10/2026 até 26/10/2026",
      "idade mínima de 16 anos",
      "2º ano do Ensino Médio",
      "6\\.000,00",
      "3\\.000,00",
      "1\\.000,00",
      "inscrições são gratuitas"
    ],
    "dynamic": false,
    "categories": [
      "competicoes",
      "eventos"
    ],
    "country": "BR",
    "state": "MS",
    "city": "Dourados",
    "deadline": "2026-10-26",
    "submission": false,
    "start": "2026-10-29",
    "requirements": "Modalidade presencial. A partir de 16 anos e cursando ao menos o 2º ano do Ensino Médio; equipes obrigatórias de quatro integrantes. Há cinco equipes externas e cinco de alunos/egressos do Senac. Protótipo na versão do Figma fornecida pela organização; MVPs ficam sob titularidade do Senac MS, com direito de autoria preservado e transferência às instituições apoiadoras/beneficiárias. Presencial no Senac Dourados/MS, de 29 a 31/10/2026. Inscrição geral até 26/10 ou lotação; o lote Sympla de menores exibe outra data e não estende o prazo geral. Protótipo obrigatório no Figma fornecido pela organização, sem plugins pagos. MVPs sob titularidade do Senac MS, com transferência a apoiadores/beneficiários e autoria preservada. Dez equipes: cinco externas e cinco de alunos/egressos Senac.",
    "conditions": "Inscrição gratuita; deslocamento e hospedagem não anunciados como apoio. O regulamento prevê almoço em 30 e 31/10. Premiação: R$ 6.000, R$ 3.000 e R$ 1.000 por equipe, conforme colocação, além de brindes e troféus.",
    "supplement": "https://ms.senac.br/Portals/0/adam/Content/ORPnrz30UEmWymyb_8o1qg/Link/Regulamento%20-%20Decola%20Hackathon%20Sa%C3%BAde%20-%20Ed.%20Dourados.pdf",
    "registrationUrl": "https://www.sympla.com.br/evento/decola-hackathon-missao-saude-dourados/3602434",
    "availability": "Inscrições abertas"
  },
  {
    "id": "hacktoberfest-sjc-2026",
    "url": "https://events.mlh.com/events/14779-hacktoberfest-hack-day-sao-jose-dos-campos",
    "title": "Hacktoberfest Hack Day São José dos Campos 2026",
    "institution": "GitHub Community SJC e GDG São José dos Campos",
    "checks": [
      "Hacktoberfest Hack Day São José dos Campos",
      "Saturday October 31, 2026",
      "UNIMAR São José dos Campos",
      "premiação para os 3 primeiros",
      "Working Professionals",
      "Students- University",
      "notebook com carregador"
    ],
    "dynamic": false,
    "categories": [
      "competicoes",
      "eventos"
    ],
    "country": "BR",
    "state": "SP",
    "city": "São José dos Campos",
    "deadline": null,
    "submission": true,
    "start": "2026-10-31",
    "requirements": "Modalidade presencial. Universitários e profissionais; levar notebook, carregador e conta GitHub. Projetos open source; inscrição pela MLH. Evento das 9h às 17h de Brasília. Evento em 31/10/2026, das 9h às 17h UTC−03, na UNIMAR São José dos Campos/SP. Levar notebook, carregador e conta GitHub. Prazo de inscrição não informado; realização não equivale a inscrição. Prazo de envio: None. Prazo separado de inscrição não informado; confirme ingresso na plataforma antes de preparar a solução.",
    "conditions": "Taxa de inscrição não informada na página oficial auditada. Premiação: Premiação para os três primeiros projetos; valor e natureza financeira não confirmados.",
    "supplement": null,
    "registrationUrl": "https://events.mlh.com/events/14779-hacktoberfest-hack-day-sao-jose-dos-campos/register",
    "availability": "Log In & Register"
  },
  {
    "id": "junction-2026",
    "url": "https://hackjunction.app/hackathons/junction-2026",
    "title": "Junction 2026 — European Tech Renaissance",
    "institution": "Junction",
    "checks": [
      "Junction 2026",
      "November 13th to 15th",
      "Hype Arena, Espoo",
      "Team size: 1-4",
      "Deadline 25 Oct 2026, 22:55",
      "travel grants applications have been closed"
    ],
    "dynamic": false,
    "categories": [
      "competicoes",
      "eventos"
    ],
    "country": "FI",
    "state": null,
    "city": null,
    "deadline": "2026-10-25",
    "submission": false,
    "start": "2026-11-13",
    "requirements": "Modalidade presencial. Participantes internacionais; equipes de uma a quatro pessoas; participação depende de seleção. Maratona de 48 horas na Hype Arena; apoio de viagem de €100/€300 para internacionais já encerrou. Presencial de 13 a 15/11/2026, na Hype Arena, Espoo, Finlândia. Inscrição até 25/10; página exibe 22h55 sem fuso conciliado para conversão. Auxílios de viagem encerrados; não são benefícios disponíveis.",
    "conditions": "Taxa de participação não confirmada na página auditada. Viagem/hospedagem não presumidas gratuitas. Premiação: Não consolidado nesta pesquisa.",
    "supplement": null,
    "registrationUrl": "https://hackjunction.app/events/junction-2026/registration",
    "availability": "Status Open"
  },
  {
    "id": "gemma-dev-agent-2026",
    "url": "https://www.kaggle.com/competitions/gemma-4-developer-agent/overview",
    "title": "Google — The Gemma 4 Developer Agent Competition",
    "institution": "Google DeepMind",
    "checks": [
      "Gemma 4 Developer Agent",
      "November 25, 2026.{0,8}- Entry Deadline",
      "December 2, 2026.{0,8}- Final Submission Deadline",
      "11:59 PM UTC"
    ],
    "dynamic": true,
    "categories": [
      "competicoes"
    ],
    "country": null,
    "state": null,
    "city": null,
    "deadline": "2026-11-25T23:59:00Z",
    "submission": false,
    "start": null,
    "requirements": "Modalidade online. Participação mundial sujeita às restrições dos termos; maioridade/18 anos, salvo autorização expressamente aceita; equipes de até cinco. Construir agentes de programação com as variantes Gemma aceitas e cumprir requisitos de código e avaliação. Entrada até 25/11/2026, 23h59 UTC; envio até 02/12/2026, 23h59 UTC. Artigo opcional até 12/11, sem duplicar a edição.",
    "conditions": "Sem compra obrigatória para inscrição. Treino/infraestrutura própria podem ter custos. Premiação: US$ 65.000 no ranking principal: 37 mil, 18 mil e 10 mil. Os US$ 35.000 de artigos pertencem à trilha opcional vinculada, com prazo 12/11.",
    "supplement": "https://www.kaggle.com/competitions/gemma-4-developer-agent/rules",
    "registrationUrl": null,
    "availability": "Join (?:Competition|Hackathon)"
  },
  {
    "id": "chi-bench-2026",
    "url": "https://www.kaggle.com/competitions/chi-bench",
    "title": "CHI-Bench — IEEE Big Data Cup 2026",
    "institution": "Organização do desafio CHI-Bench / Haolin Chen",
    "checks": [
      "χ-Bench",
      "Entry deadline November 7th, 2026",
      "Final Kaggle submission deadline November 15th, 2026",
      "11:59 PM UTC",
      "Managed Care Operations Handbook"
    ],
    "dynamic": true,
    "categories": [
      "competicoes"
    ],
    "country": null,
    "state": null,
    "city": null,
    "deadline": "2026-11-07T23:59:00Z",
    "submission": false,
    "start": null,
    "requirements": "Modalidade online. Mundial, maioridade/18 anos conforme termos; equipes de até cinco. Agentes para fluxos administrativos de saúde em ambiente simulado. Exige obter aprovação de acesso ao handbook, código executável e evidências de avaliação. Entrada até 07/11/2026, 23h59 UTC; envio até 15/11/2026, 23h59 UTC. Simulação administrativa de saúde; exige aprovação de acesso ao handbook e pacote reprodutível, sem presumir ida obrigatória aos EUA.",
    "conditions": "Sem compra obrigatória para inscrição; computação/modelos próprios não são apoio financeiro presumido. Premiação: US$ 3.000 distribuídos entre ouro, prata e bronze; Reliability Award separado.",
    "supplement": "https://www.kaggle.com/competitions/chi-bench/rules",
    "registrationUrl": null,
    "availability": "Join (?:Competition|Hackathon)"
  },
  {
    "id": "3lc-low-light-2026",
    "url": "https://www.kaggle.com/competitions/the-3lc-low-light-detection-challenge/overview/abstract",
    "title": "The 3LC Low-Light Detection Challenge",
    "institution": "Equipe 3LC / anfitrião RishikeshJadhav3LC no Kaggle",
    "checks": [
      "3LC Low-Light Detection Challenge",
      "Final submission deadline Saturday 21 November 2026, 23:59 UTC",
      "Evaluation form deadline .{0,30}Monday 30 November 2026, 23:59 UTC",
      "Non-Commercial",
      "Python 3\\.11"
    ],
    "dynamic": true,
    "categories": [
      "competicoes"
    ],
    "country": null,
    "state": null,
    "city": null,
    "deadline": "2026-11-21T23:59:00Z",
    "submission": true,
    "start": null,
    "requirements": "Modalidade online. Mundial conforme termos; maioridade/18 anos; equipes de até quatro. Detecção de objetos em baixa luminosidade; formulário de avaliação para elegibilidade aos prêmios até 30/11/2026 às 23h59 UTC. Prazo de envio: 2026-11-21T23:59:00Z. Prazo separado de inscrição não informado; confirme ingresso na plataforma antes de preparar a solução.",
    "conditions": "Inscrição sem compra obrigatória; conta 3LC Non-Commercial gratuita. Requer máquina própria compatível, Python e instalação local; GPU recomendada. Premiação: US$ 2.000 no total, distribuídos por critérios da competição.",
    "supplement": "https://www.kaggle.com/competitions/the-3lc-low-light-detection-challenge/rules",
    "registrationUrl": null,
    "availability": "Join (?:Competition|Hackathon)"
  },
  {
    "id": "buildarena-s02-2026",
    "url": "https://www.kaggle.com/competitions/build-arena-human-ai-engineering-challenge/overview/hackathon-tracks-and-prizes",
    "title": "BuildArena S02 — Human AI Engineering Challenge",
    "institution": "Equipe BuildArena; instituições e apoio identificados no overview",
    "checks": [
      "BuildArena",
      "Submission deadline November 14, 2026 AOE",
      "UTC[−-]12",
      "Besiege",
      "The Broken Beyond",
      "Build with Agent"
    ],
    "dynamic": true,
    "categories": [
      "competicoes"
    ],
    "country": null,
    "state": null,
    "city": null,
    "deadline": "2026-11-14",
    "submission": true,
    "start": null,
    "requirements": "Modalidade online. Participação global conforme termos Kaggle; equipes de até três. Agente constrói, simula e melhora máquina/controlador pelo MCP BuildArena 2.0; trilha humana é demonstrativa e não concorre ao prêmio principal. Prazo de envio: 2026-11-14 (AoE, UTC−12). Prazo separado de inscrição não informado; confirme ingresso na plataforma antes de preparar a solução.",
    "conditions": "Exige jogo Besiege e DLC The Broken Beyond. A organização oferece chave do jogo base mediante formulário; não há confirmação de custeio do DLC ou de chamadas a modelos. Premiação: US$ 3.000 no total na trilha Build with Agent.",
    "supplement": "https://www.kaggle.com/competitions/build-arena-human-ai-engineering-challenge/rules",
    "registrationUrl": null,
    "availability": "Join (?:Competition|Hackathon)"
  },
  {
    "id": "climx-2026",
    "url": "https://ipl-uv.github.io/ClimX/",
    "title": "ClimX — Extreme-aware Climate Model Emulation",
    "institution": "Image and Signal Processing Laboratory, Universitat de València; prêmios ESA Φ-lab",
    "checks": [
      "ClimX",
      "December 15, 2026 — ClimX submission deadline",
      "€3,300 in main-track prizes",
      "€1,800",
      "€1,000",
      "€500",
      "Teams are limited to 10 members",
      "MIT or Apache-2\\.0",
      "no external CMIP6 data"
    ],
    "dynamic": false,
    "categories": [
      "competicoes"
    ],
    "country": null,
    "state": null,
    "city": null,
    "deadline": "2026-12-15",
    "submission": true,
    "start": null,
    "requirements": "Modalidade online. Participação mundial conforme regras Kaggle; maioridade/18 anos; equipes de até dez. Código e pesos abertos em MIT ou Apache-2.0 para premiação; dados e modelos de fora proibidos nos termos específicos. Prazo de envio: 2026-12-15. Prazo separado de inscrição não informado; confirme ingresso na plataforma antes de preparar a solução. Trilha principal via Kaggle; uma ficha para a edição, sem duplicar a trilha UQ. Somente dados fornecidos pela organização; não usar modelos pré-treinados em CMIP6. Inscrição sujeita aos termos atuais Kaggle, idade e restrições territoriais da plataforma.",
    "conditions": "Sem compra obrigatória para inscrição; processamento e infraestrutura de treinamento não são benefício garantido. Premiação: € 3.300 na trilha principal: €1.800, €1.000 e €500, sujeitos à classificação e reprodutibilidade.",
    "supplement": null,
    "registrationUrl": "https://www.kaggle.com/competitions/climx-main-track",
    "availability": "challenge is open for submissions"
  }
];
export const isHackathonEdition = (id: string) => HACKATHON_EDITIONS.some(item => item.id === id);
export const hackathonSupplement = (id: string) => HACKATHON_EDITIONS.find(item => item.id === id)?.supplement;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
function visible(html: string) {
 const $ = cheerio.load(html);
 $("script,style,noscript,nav").remove();
 $("p,div,h1,h2,h3,h4,h5,h6,li,td,a,button,span,strong").append(" ");
 return { $, text: clean($("body").text()) };
}

export function normalizeHackathonEdition(html: string, supplement: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
 const edition = HACKATHON_EDITIONS.find(item => item.id === source.id);
 if (!edition) return [];
 if (source.baseUrl !== edition.url || source.listingUrls.length !== 1 || source.listingUrls[0] !== edition.url)
  throw new Error("URL da edição fora da auditoria");
 const { $, text } = visible(html);
 const supplementText = edition.supplement?.endsWith(".pdf") ? clean(supplement) : visible(supplement).text;
 const missing = edition.checks.filter(pattern => !new RegExp(pattern, "iu").test(text));
 if (missing.length)
  throw new Error(edition.dynamic ? "Conteúdo dinâmico oficial incompleto; fonte não pode ser ativada" : `Evidência da edição mudou; requer nova auditoria: ${missing.join("; ")}`);
 if (edition.id === "senac-ms-decola-saude-2026" &&
  [/Missão Saúde/, /obrigatória de quatro integrantes/, /Figma/, /titularidade\s*do SENAC\s*MS/i, /direito de autoria/, /26\/10\/2026/].some(pattern => !pattern.test(supplementText)))
  throw new Error("Regulamento Decola não confirma condições obrigatórias");
 // Prepared Kaggle adapters must read BOTH live overview and rules. A title-only JS envelope is insufficient.
 if (edition.dynamic && !/Competition Rules/i.test(supplementText)) throw new Error("Regras oficiais não legíveis");
 const statusText = edition.id === "junction-2026"
  ? text.replace(/€300 & €100 travel grants applications have been closed for international participants\./i, "") : text;
 const terminal = confirmedTerminalStatus(statusText, edition.title) ??
  (/\b(?:tickets sold out|ingressos esgotados|(?:registrations?|submissions?|competition|hackathon|challenge|event) (?:is |are |has |have |was )?(?:closed|ended|cancelled|canceled|suspended))\b/iu.test(statusText) ? "closed" : null);
 const available = new RegExp(edition.availability, "iu").test(text) &&
  (edition.dynamic ? $("button,a").toArray().some(node => /Join (?:Competition|Hackathon)/i.test(clean($(node).text())) &&
    $(node).attr("disabled") === undefined && $(node).attr("aria-disabled") !== "true") :
   $("a[href]").toArray().some(node => {
    try { return new URL($(node).attr("href")!, edition.url).href === edition.registrationUrl; } catch { return false; }
   }));
 const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
 const current = edition.deadline ? (edition.deadline.includes("T") ? Date.parse(edition.deadline) >= now.getTime() : today <= edition.deadline) : eventHasNotStarted(edition.start, now);
 const proof = (excerpt: string, url = edition.url) => ({ source_url: url, excerpt });
 const evidence: OpportunityCandidate["evidenceJson"] = {
  opportunity_status: proof(terminal ?? (available ? "Participação disponível na edição oficial auditada." : "Chamada de participação ausente.")),
  requirements: proof(edition.requirements, edition.supplement ?? edition.url), conditions: proof(edition.conditions),
 };
 if (edition.deadline) {
  evidence.deadline_at = proof(`${edition.submission ? "Envio" : "Inscrição"} até ${edition.deadline}.`);
  if (edition.submission) evidence.submission_deadline = proof(`Prazo de envio ${edition.deadline}; prazo separado de inscrição não informado.`);
 } else {
  evidence.event_start = proof(`Realização em ${edition.start}; não é prazo de inscrição.`);
  evidence.registration_availability = proof(available ? "Link oficial de inscrição disponível; data final não informada." : "Link de inscrição ausente.");
 }
 return [{ officialSourceId: source.id, title: edition.title, institution: edition.institution,
  sourcePageUrl: edition.url, applicationUrl: edition.url, officialDocumentUrl: edition.supplement ?? undefined,
  applicationRoute: "direct_application", applicantType: "mixed", benefitType: "prize", categories: [...edition.categories],
  requiresManualReview: edition.dynamic, sourceConflict: edition.dynamic,
  isCourse: false, nationallyEligible: false, countryCode: edition.country, stateCode: edition.state, cityName: edition.city,
  geographicScopeKind: edition.state ? "city" : edition.country ? "country" : "global",
  eventStartsAt: edition.start, deadlineAt: edition.deadline ?? undefined,
  deadlinePrecision: edition.deadline ? (edition.deadline.includes("T") ? "exact_datetime" : "date_only") : "not_informed",
  opportunityStatus: terminal ?? (available && current ? "open" : "closed"), reviewStatus: "needs_information",
  requirementsText: edition.requirements, amountText: edition.conditions, evidenceJson: evidence, extractionMethod: "html",
  contentHash: crypto.createHash("sha256").update(`hackathon-editions-v1\n${source.id}\n${text}\n${supplementText}`).digest("hex"),
 }];
}
