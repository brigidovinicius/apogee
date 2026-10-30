import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import { eventHasNotStarted } from "./event-start";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const MLH_GLOBAL_URL = "https://ghw.mlh.com/";
type Edition = {
  id: string; url: string; title: string; institution: string;
  checks: RegExp[]; availability?: RegExp; registrationUrl: string; registrationLabel: RegExp;
  start?: string; deadline?: string; categories: NonNullable<OpportunityCandidate["categories"]>;
  state: OpportunityCandidate["stateCode"]; city: string | null;
  national?: boolean; global?: boolean; supplement?: string;
  requirements: string; conditions: string;
};
const unknownCosts = "Taxa de inscrição, remuneração e apoio financeiro não informados na página oficial. Consulte as condições da organização.";
const mlhRequirements = "Modalidade online, em inglês, para estudantes e profissionais. Participação global, incluindo o Brasil. Menores de 13 a 18 anos precisam de permissão dos responsáveis. Exige conta MLH e aceite do código de conduta e das regras. Semana de desafios técnicos, projetos e encontros da comunidade; pontos e brindes condicionados às regras não equivalem a prêmio em dinheiro.";
const mlhChecks = [/Event is hosted online/i, /Minors \(Between 13-18\)/, /parent.s permission/, /Major League Hacking/];

/** Exact organizer editions audited on 20/10. Never crawl checkout, forms or sibling editions. */
export const COMMUNITY_EDITIONS: readonly Edition[] = [
  { id: "workintech-unicesumar-2026", url: "https://www.workintech.com.br/", title: "WorkInTech e Hackathon — UniCesumar Maringá 2026", institution: "UniCesumar e Axion",
    checks: [/EDIÇÃO 2026/, /26 e 27 de outubro/, /hackathon nos dias 28, 29 e 30/i, /4–6\s*Pessoas por equipe/, /MARINGÁ/], availability: /INSCRIÇÕES ABERTAS/,
    registrationUrl: "https://www.workintech.com.br/login?next=hackathon", registrationLabel: /QUERO PARTICIPAR/i,
    start: "2026-10-26", categories: ["eventos", "competicoes"], state: "PR", city: "Maringá",
    requirements: "Modalidade presencial na UniCesumar, em Maringá/PR. Workshops em 26 e 27/10; hackathon em 28, 29 e 30/10/2026, com equipes previstas de quatro a seis pessoas e avaliação por banca. Evento voltado a alunos de tecnologia; confirme vínculo e critérios de ingresso com a organização. Cadastro na plataforma do evento. Uma edição, incluindo os workshops e o hackathon; recrutamento anunciado não significa vaga de emprego garantida.", conditions: unknownCosts },
  { id: "connect-hackathon-7-2026", url: "https://connectinovacao.com.br/hackathon/", title: "Hackathon Connect 7.0 — 2026", institution: "Connect Inovação",
    checks: [/Hackathon 7\.0 Connect/, /14 de novembro de 2026/, /09h às 21h/, /equipes devem ter entre 3 e 5 integrantes/i, /totalmente gratuitas/, /hubs de inovação parceiros espalhados pelo Brasil/],
    registrationUrl: "https://hack.connectinovacao.com.br/", registrationLabel: /Inscrev|Inscrever/i,
    start: "2026-11-14", categories: ["eventos", "competicoes"], state: null, city: null, national: true,
    requirements: "Modalidade híbrida: participação online ou presencial em hubs parceiros no Brasil, conforme vagas. Aberto a estudantes, profissionais, empreendedores, pesquisadores e interessados em inovação. Equipes de três a cinco pessoas para concorrer; inscrição individual permite procurar equipe. Menores de 18 anos precisam de autorização validada do responsável. Evento em 14/11/2026, das 9h às 21h; entrega das soluções às 21h de Brasília. Esse horário é de entrega, não prazo de inscrição. Confira o regulamento e o endereço do hub escolhido.",
    conditions: "Inscrição e participação gratuitas. Premiação sujeita às regras da organização; não há valor financeiro confirmado nesta ficha. Despesas pessoais de transporte, alimentação e hospedagem são do participante, salvo apoio expressamente anunciado pelo hub." },
  { id: "obvc-2026", url: "https://obvc.com.br/", title: "Olimpíada Brasileira de Vibe Coding — OBVC 2026", institution: "Organização da OBVC",
    checks: [/Olimpíada Brasileira\s*de Vibe Coding/i, /Inscrições até\s*31 de outubro de 2026/, /1º de novembro de 2026/, /Universitária/, /R\$\s*60/, /R\$\s*120/, /50\.000/, /100\.000/, /é tudo online/, /prêmios crescem com o número de inscritos/i, /residentes no Brasil/],
    registrationUrl: "https://obvc.com.br/inscricao", registrationLabel: /Inscreva-se/i,
    deadline: "2026-10-31", categories: ["competicoes"], state: null, city: null, national: true,
    requirements: "Modalidade online, para brasileiros ou residentes no Brasil, conforme o regulamento. Categorias Universitária e Ampla na mesma edição. A Universitária exige comprovação de matrícula para avaliação. Cada inscrição corresponde a um projeto. Inscrições até 31/10/2026; envio do projeto até 01/11/2026, com interface em português brasileiro. Avaliação pela comissão; não é maratona cronometrada. Confira propriedade intelectual, critérios e condições no regulamento oficial.",
    conditions: "Inscrição paga: R$ 60,00 na Universitária e R$ 120,00 na Ampla. Cupom de universidade parceira pode reduzir a taxa, sujeito à elegibilidade. Prêmios variam com o número de inscrições válidas: até R$ 50.000,00 para o primeiro lugar da Universitária e até R$ 100.000,00 na Ampla. São tetos condicionais da escala de premiação, não valores garantidos, bolsa ou salário." },
  { id: "soujava-november-2026", url: "https://encontros.soujava.org.br/talks/novembro-2026/", title: "Encontro do SouJava — Novembro 2026", institution: "SouJava",
    checks: [/Encontro do SouJava - Novembro 2026/, /13 November 2026/, /No dia 13\/11/, /Oracle São Paulo/, /Juarez Barbosa Junior/, /Bruno Silva/],
    registrationUrl: "https://encontros.soujava.org.br/checkout/select-tickets/", registrationLabel: /Reservar minha vaga/i,
    start: "2026-11-13", categories: ["eventos"], state: "SP", city: "São Paulo",
    requirements: "Encontro da comunidade Java, em parceria com Oracle Brasil, em 13/11/2026. Local presencial: Oracle, Rua Dr. José Áureo Bustamante, 455, São Paulo/SP. Palestras sobre agentes de IA, Java, RAG e refatoração. A descrição informa 18h30 e o calendário exibe horário convertido: consulte a organização para confirmar horário e acesso à transmissão; a ficha preserva somente a data. Reserva pela página oficial do encontro.", conditions: unknownCosts },
  { id: "mlh-builders-november-2026", url: "https://events.mlh.com/events/14729-global-hack-week-builders-week", title: "Global Hack Week — Builders Week 2026", institution: "Major League Hacking",
    checks: [/Global Hack Week: Builders Week/, /Friday November 6, 2026/, /Nov 12/, ...mlhChecks],
    registrationUrl: "https://events.mlh.com/events/14729-global-hack-week-builders-week/register", registrationLabel: /Log In & Register/,
    start: "2026-11-06", categories: ["eventos"], state: null, city: null, national: true, global: true, supplement: MLH_GLOBAL_URL,
    requirements: "De 6 a 12/11/2026. " + mlhRequirements, conditions: "Participação gratuita. Sem premiação em dinheiro confirmada nesta ficha; brindes e envio sujeitos às regras da MLH." },
  { id: "mlh-open-source-december-2026", url: "https://events.mlh.com/events/15199-global-hack-week-open-source-week", title: "Global Hack Week — Open Source Week 2026", institution: "Major League Hacking",
    checks: [/Global Hack Week: Open Source Week/, /Friday December 4, 2026/, /Dec 10/, ...mlhChecks],
    registrationUrl: "https://events.mlh.com/events/15199-global-hack-week-open-source-week/register", registrationLabel: /Log In & Register/,
    start: "2026-12-04", categories: ["eventos"], state: null, city: null, national: true, global: true, supplement: MLH_GLOBAL_URL,
    requirements: "De 4 a 10/12/2026. " + mlhRequirements, conditions: "Participação gratuita. Sem premiação em dinheiro confirmada nesta ficha; brindes e envio sujeitos às regras da MLH." },
  { id: "devopsdays-florianopolis-2026", url: "https://devopsdays.org/events/2026-florianopolis/welcome/", title: "DevOpsDays Florianópolis 2026", institution: "Comunidade DevOpsDays Florianópolis",
    checks: [/devopsdays Florianópolis/i, /October 24, 2026/, /Centro Universitário Cesusc/, /SC-401, 9301/],
    registrationUrl: "https://www.sympla.com.br/evento/devopsdays-florianopolis-2026/3563063", registrationLabel: /Adquira seu ingresso/i,
    start: "2026-10-24", categories: ["eventos"], state: "SC", city: "Florianópolis",
    requirements: "Modalidade presencial, em 24/10/2026, no Centro Universitário Cesusc — UNICESUSC, SC-401, 9301, Florianópolis/SC. Conferência da comunidade DevOps, com conteúdo e troca de experiências. Inscrição pelo link de ingresso indicado na página oficial. Horários, disponibilidade e condições devem ser confirmados com a organização.", conditions: unknownCosts },
  { id: "devopsdays-recife-2026", url: "https://devopsdays.org/events/2026-recife/welcome/", title: "DevOpsDays Recife 2026", institution: "Comunidade DevOpsDays Recife",
    checks: [/DEVOPSDAYS RECIFE - 2026/, /12 de dezembro de 2026/, /das 8h às 18h/, /UNINASSAU Graças/, /Rios, Pontes e Tecnologia/],
    registrationUrl: "https://www.even3.com.br/devopsdays-recife-770771/", registrationLabel: /^INGRESSOS$/,
    start: "2026-12-12", categories: ["eventos"], state: "PE", city: "Recife",
    requirements: "Modalidade presencial, em 12/12/2026, das 8h às 18h, na UNINASSAU Graças, Bloco B, Auditório Roque de Brito, Recife/PE. Conferência sobre cultura DevOps, automação, plataforma e segurança, para profissionais e interessados. Tema Rios, Pontes e Tecnologia. Ingresso pela plataforma indicada na página oficial; confirme disponibilidade e condições.", conditions: unknownCosts },
  { id: "enap-innovation-week-2026", url: "https://semanadeinovacao.enap.gov.br/faq/", title: "Semana de Inovação — Enap 2026", institution: "Escola Nacional de Administração Pública — Enap",
    availability: /Semana de Inovação 2026 já estão abertas/, checks: [/Semana de Inovação 2026/, /10 a 12 de novembro de 2026/, /sede da Enap, em Brasília/, /totalmente gratuita/, /presencial e remota \(online\)/],
    registrationUrl: "https://si-2026-enap.mesa.tech/login", registrationLabel: /Garanta a sua vaga/i,
    start: "2026-11-10", categories: ["eventos"], state: "DF", city: "Brasília",
    requirements: "Modalidade híbrida, de 10 a 12/11/2026: presencial na Enap, Brasília/DF, e online via YouTube e Zoom. Inscrição única com escolha da modalidade; vagas presenciais limitadas. Inscrição geral não garante vaga em cada atividade, que exige reserva própria conforme lotação. Menores de 18 anos devem estar acompanhados dos responsáveis. Certificado conforme participação. O prazo encerrado para propostas de atividades não é o prazo de inscrição do público.",
    conditions: "Participação gratuita. Serviço opcional de acolhimento de crianças é cobrado pelo prestador. Viagem, hospedagem, alimentação e remuneração não anunciadas como apoio ao participante nesta página." },
  { id: "recnplay-2026", url: "https://recnplay.pe/", title: "REC’n’Play — Festival 2026", institution: "Organização do REC’n’Play",
    // The organizer separated the edition title, date and enrollment CTA on 28/10.
    // Preserve the audited facts and exact edition-specific enrollment URL.
    checks: [/REC[’']n[’']Play\s+2026\b/i, /\b11 a 14 de novembro\b/i, /festival gratuito de inovação/i, /centro histórico do Recife/i],
    registrationUrl: "https://register.jalanlive.com/recnplay2026/form?pos=415", registrationLabel: /Inscrições REC.n.Play|^Inscreva-se$/i,
    start: "2026-11-11", categories: ["eventos"], state: "PE", city: "Recife",
    requirements: "Modalidade presencial, de 11 a 14/11/2026, em espaços do centro histórico do Recife/PE. Festival de inovação, tecnologia, criatividade e cultura, com oficinas, experiências e networking. Inscrição de participante pela plataforma indicada no site oficial; confira lotação, programação e regras de cada atividade. Voluntariado é outra seleção e não é uma vaga implícita nesta ficha.",
    conditions: "Festival com participação gratuita. Viagem, hospedagem, alimentação e remuneração não informadas como benefícios do participante na página consultada." },
];

export const isCommunityEdition = (id: string) => COMMUNITY_EDITIONS.some(edition => edition.id === id);
export const communityEditionSupplement = (id: string) => COMMUNITY_EDITIONS.find(edition => edition.id === id)?.supplement;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();

export function normalizeCommunityEdition(html: string, supplement: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  const edition = COMMUNITY_EDITIONS.find(item => item.id === source.id);
  if (!edition) return [];
  if (source.baseUrl !== edition.url || source.listingUrls.length !== 1 || source.listingUrls[0] !== edition.url) throw new Error("URL da edição fora da auditoria");
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,aside").remove();
  $("p,div,h1,h2,h3,h4,li,td,a,button").append(" ");
  const text = clean($("body").text());
  if (edition.id === "recnplay-2026" && $("h1").length &&
    ($("h1").length !== 1 || !/^REC[’']n[’']Play\s+2026$/i.test(clean($("h1").text())))) {
    throw new Error("Evidência da edição mudou; requer nova auditoria");
  }
  // ENAP's expired call for speaker proposals is separate from public attendance.
  const statusText = edition.id === "enap-innovation-week-2026"
    ? text.replace(/Como posso submeter uma proposta de atividade\?[\s\S]*?primeiro semestre\./i, "") : text;
  const terminal = confirmedTerminalStatus(statusText, edition.title) ??
    (/\b(?:ingressos esgotados|tickets sold out|registrations? (?:is |are |has |have )?(?:closed|ended)|event (?:is |was )?cancelled)\b/i.test(text) ? "closed" : null);
  // Identity/date evidence is still required for terminal notices; altered editions need a new audit.
  if (edition.checks.some(pattern => !pattern.test(text))) throw new Error("Evidência da edição mudou; requer nova auditoria");
  const available = (!edition.availability || edition.availability.test(text)) && $("a[href]").toArray().some(node => {
    try { return new URL($(node).attr("href")!, edition.url).href === edition.registrationUrl && edition.registrationLabel.test(clean($(node).text())); }
    catch { return false; }
  });
  const supplementPage = cheerio.load(supplement);
  supplementPage("script,style,noscript").remove();
  const supplementText = edition.supplement ? clean(supplementPage("body").text()) : "";
  if (edition.supplement && !/Global Hack Week is a 100% free event for anyone, anywhere/.test(supplementText)) throw new Error("Elegibilidade global e gratuidade MLH não confirmadas");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const current = edition.deadline ? today <= edition.deadline : eventHasNotStarted(edition.start, now);
  const proof = (excerpt: string) => ({ source_url: edition.url, excerpt });
  const evidence: OpportunityCandidate["evidenceJson"] = {
    opportunity_status: proof(terminal ?? (available ? "Chamada de inscrição presente na edição oficial auditada." : "Chamada de inscrição ausente.")),
    requirements: proof(edition.requirements), conditions: proof(edition.conditions),
  };
  if (edition.deadline) evidence.deadline_at = proof("Inscrições até 31 de outubro de 2026; entrega do projeto até 1º de novembro de 2026.");
  else {
    evidence.event_start = proof(`Início da edição em ${edition.start}; data de realização, não prazo de inscrição.`);
    evidence.registration_availability = proof(available ? "Link oficial de inscrição vigente, sem data final de inscrição informada." : "Link de inscrição ausente.");
  }
  if (edition.national) evidence.national_scope = edition.supplement
    ? { source_url: edition.supplement, excerpt: "Global Hack Week is a 100% free event for anyone, anywhere!" }
    : proof(edition.id === "obvc-2026" ? "Aberta a brasileiros e residentes no Brasil; modalidade online." : "Participação online e presencial nos hubs de inovação parceiros espalhados pelo Brasil.");
  return [{ officialSourceId: source.id, title: edition.title, institution: edition.institution,
    sourcePageUrl: edition.url, applicationUrl: edition.url, applicationRoute: "direct_application",
    applicantType: "mixed", benefitType: edition.id === "obvc-2026" ? "prize" : "other", categories: [...edition.categories],
    isCourse: false, nationallyEligible: edition.national ?? false,
    countryCode: edition.global ? null : "BR", stateCode: edition.state, cityName: edition.city,
    geographicScopeKind: edition.global ? "global" : edition.national ? "country" : "city",
    eventStartsAt: edition.start, deadlineAt: edition.deadline, deadlinePrecision: edition.deadline ? "date_only" : "not_informed",
    opportunityStatus: terminal ?? (available && current ? "open" : "closed"), reviewStatus: "needs_information",
    requirementsText: edition.requirements, amountText: edition.conditions, evidenceJson: evidence, extractionMethod: "html",
    contentHash: crypto.createHash("sha256").update(`community-editions-v1\n${source.id}\n${text}\n${supplementText}`).digest("hex"),
  }];
}
