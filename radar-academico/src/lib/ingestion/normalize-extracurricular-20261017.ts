import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { confirmedTerminalStatus } from "./publication";
import type { OfficialSource, OpportunityCandidate } from "./types";

export const FGV_DATATHON_ID = "fgv-eesp-datathon-7-2026";
export const FGV_DATATHON_URL = "https://eesp.fgv.br/evento/7o-desafio-de-dados-datathon-de-moedas-digitais-da-fgv-eesp";
export const CPS_ROBOCODE_ID = "cps-robocode-14-2026";
export const CPS_ROBOCODE_URL = "https://robotica.cps.sp.gov.br/robocode-2026";
export const IFMG_JECT_ID = "ifmg-formiga-xv-ject-2026";
export const IFMG_JECT_URL = "https://www.formiga.ifmg.edu.br/todas-noticias/3944-xv-ject-abre-inscricoes-para-participacao-em-programacao-com-mais-de-30-atividades";
export const AMAZONIA_ID = "unievangelica-amazonia-extension-2027";
export const AMAZONIA_URL = "https://www4.unievangelica.edu.br/noticia/unievangelica-abre-inscricoes-para-projeto-de-extensao-e-responsabilidade-social-na-amazonia";
export const AMAZONIA_DOCUMENT_URL = "https://www4.unievangelica.edu.br/storage/19222/Chamamento-Amaz%C3%B4nia.pdf";
const urls: Record<string, string> = {
  [FGV_DATATHON_ID]: FGV_DATATHON_URL, [CPS_ROBOCODE_ID]: CPS_ROBOCODE_URL,
  [IFMG_JECT_ID]: IFMG_JECT_URL, [AMAZONIA_ID]: AMAZONIA_URL,
};
export const isExtracurricularEdition = (id: string) => Object.hasOwn(urls, id);
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
function requireEvidence(text: string, patterns: RegExp[]) {
  if (patterns.some(pattern => !pattern.test(text))) throw new Error("Evidência da edição mudou; requer nova auditoria");
}

/** Only the four audited editions; never crawl forms, seats, teams or programme menus. */
export function normalizeExtracurricularEdition(html: string, supplement: string, source: OfficialSource, now = new Date()): OpportunityCandidate[] {
  if (!isExtracurricularEdition(source.id)) return [];
  const url = urls[source.id];
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,header,aside").remove();
  $("p,div,h1,h2,h3,h4,li,td,a").append(" ");
  const headings = clean($("h1").text());
  const region = source.id === FGV_DATATHON_ID ? $("article").first()
    : source.id === CPS_ROBOCODE_ID ? $(".cps-texto-conteudo__sem-sidebar").first()
    : source.id === IFMG_JECT_ID ? $(".com-content-article").first() : $("body");
  // The university footer and related news are outside the edition's evidence.
  const text = clean(region.text()).split(" Explore Vestibular")[0];
  const links = region.find("a[href]").toArray().map(node => ({ label: clean($(node).text()), href: $(node).attr("href") ?? "" }));
  const terminal = confirmedTerminalStatus(text);
  let title: string, deadline: string, requirements: string, amount: string;
  let candidate: Pick<OpportunityCandidate, "applicantType" | "benefitType" | "categories" | "nationallyEligible" |
    "countryCode" | "stateCode" | "cityName" | "geographicScopeKind" | "eventStartsAt" | "officialDocumentUrl">;
  let registration: boolean;
  if (source.id === FGV_DATATHON_ID) {
    title = "7º Datathon de Moedas Digitais — FGV EESP 2026";
    requireEvidence(headings, [/7º Desafio de Dados \(Datathon\) de Moedas Digitais da FGV EESP/]);
    if (!terminal) requireEvidence(text, [/Inscrições: de 22 de setembro a 23 de outubro de 2026/i,
      /competição on-line/i, /regularmente matriculados em cursos de graduação no Brasil/i,
      /três a cinco integrantes/i, /Inscrições individuais/i, /até 20 equipes/i,
      /A participação é gratuita/i, /1º lugar: R\$ 7\.000,00/, /2º lugar: R\$ 5\.000,00/, /3º lugar: R\$ 3\.000,00/,
      /Abertura do desafio: 30 de outubro de 2026, às 9h \(horário de Brasília\)/i]);
    deadline = "2026-10-23";
    registration = links.some(link => link.href === "https://evento.fgv.br/7datathonfgveesp2209/");
    requirements = "Modalidade online. Competição para estudantes regularmente matriculados em graduação no Brasil. Equipes de três a cinco integrantes; candidatura individual pode ser agrupada pelo comitê conforme disponibilidade. Até 20 equipes, com mentoria e critérios de seleção. Início em 30/10/2026, às 9h de Brasília; entrega dos projetos em 08/11. Certificado e credencial para quem entregar a solução. Consulte o regulamento da edição.";
    amount = "Premiação em dinheiro: R$ 7.000,00 para a equipe em 1º lugar, R$ 5.000,00 para a equipe em 2º e R$ 3.000,00 para a equipe em 3º. Participação gratuita. Eventuais vagas em curso são condicionadas à disponibilidade; não há bolsa mensal anunciada.";
    candidate = { applicantType: "undergraduate_student", benefitType: "prize", categories: ["competicoes", "pesquisa"],
      nationallyEligible: true, countryCode: "BR", stateCode: null, cityName: null, geographicScopeKind: "country", eventStartsAt: "2026-10-30T09:00:00-03:00" };
  } else if (source.id === CPS_ROBOCODE_ID) {
    title = "14º Torneio Robocode — Etecs e Fatecs 2026";
    requireEvidence(headings, [/14º Torneio Robocode 2026/]);
    if (!terminal) requireEvidence(text, [/Alunos de Etecs e Fatecs/, /Equipes de até 3 integrantes matriculados/,
      /Participação em apenas uma equipe por aluno/, /Até 30\/10\/2026/, /01\/11 a 30\/11\/2026/,
      /prêmios para os 3 melhores/i, /Certificados para todos os participantes/i]);
    deadline = "2026-10-30";
    registration = links.some(link => /^Inscrever Equipe$/i.test(link.label) && link.href === "https://forms.gle/EA5fnqBu8V3qeYqy5");
    requirements = "Para alunos matriculados em Etecs e Fatecs do Centro Paula Souza, em equipes de até três; cada aluno pode integrar apenas uma equipe. Robô em Java com o mesmo nome da equipe e autorização de imagem dos integrantes. Uso de IA é opcional e deve ser documentado no código. Inscrição, batalhas locais e envio do relatório até 30/10/2026; final remota em novembro. Confirme os procedimentos com sua unidade.";
    amount = "Certificados aos participantes e prêmios para os três melhores na fase final, sem valor financeiro anunciado. Taxa de inscrição e remuneração não informadas na página oficial.";
    candidate = { applicantType: "mixed", benefitType: "prize", categories: ["competicoes", "pesquisa"],
      nationallyEligible: false, countryCode: "BR", stateCode: "SP", cityName: null, geographicScopeKind: "state" };
  } else if (source.id === IFMG_JECT_ID) {
    title = "XV Jornada de Educação, Ciência e Tecnologia — IFMG Formiga 2026";
    requireEvidence(headings, [/XV JECT abre inscrições para participação em programação com mais de 30 atividades/]);
    if (!terminal) requireEvidence(text, [/inscrições abertas até dia 20 de outubro/i, /27 a 29 de outubro de 2026/,
      /programação diversificada e gratuita/i, /atividades presenciais/i, /público em geral/i, /IFMG Campus Formiga/]);
    deadline = "2026-10-20";
    registration = links.some(link => link.href.startsWith("https://www.even3.com.br/xvject-758596/") && /Inscrições e informações/i.test(link.label));
    requirements = "Modalidade presencial, em Formiga/MG, de 27 a 29/10/2026, aberta à comunidade acadêmica e ao público em geral. Programação com palestras, oficinas, seminários e feira de oportunidades; inscrição pela plataforma indicada pelo IFMG. Abertura na CDL em 27/10, das 19h às 22h. Confira horários, locais e regras de cada atividade na programação oficial; as atividades internas não são oportunidades duplicadas.";
    amount = "Participação gratuita. Apoio financeiro, transporte, alimentação e remuneração não informados na notícia oficial.";
    candidate = { applicantType: "mixed", benefitType: "other", categories: ["eventos", "pesquisa"],
      nationallyEligible: false, countryCode: "BR", stateCode: "MG", cityName: "Formiga", geographicScopeKind: "city", eventStartsAt: "2026-10-27" };
  } else {
    title = "Projeto de extensão Amazônia Cidadã — UniEVANGÉLICA 2027";
    requireEvidence(headings, [/UniEVANGÉLICA abre inscrições para projeto de extensão e responsabilidade social na Amazônia/]);
    if (!terminal) requireEvidence(text, [/Edição 2027/, /15 a 30 de outubro de 2026/, /17 vagas/, /regularmente matriculados na UniEVANGÉLICA/,
      /instituições internacionais/, /taxa de alimentação de R\$ 500/i, /hospedagem fluvial e terrestre/]);
    const document = clean(supplement);
    if (!terminal) requireEvidence(document, [/CHAMAMENTO/, /Edição 2027/, /15 a 30\/10\/26/, /VOLUNTÁRIOS PAGANTES/, /Taxa de alimentação.*?R\$ 500,00/i,
      /Transporte aéreo/, /hospedagem fluvial e terrestre/, /Curso de Medicina.*?9º e 10ºp/,
      /Curso de Odontologia.*?8ºp/, /Curso de Enfermagem.*?8ºp/, /Curso de Fisioterapia.*?6ºp/,
      /Curso de Psicologia.*?8ºp/, /Curso de Teologia.*?3ºp/, /25 de abril a 1º de maio de 2027/]);
    deadline = "2026-10-30";
    registration = links.some(link => link.href.startsWith("https://docs.google.com/forms/d/e/1FAIpQLSepO2KvDbz2GZ_chwJUxgS-_lM4xXZb6_s1y5hu0X10ex-bPg/viewform"));
    requirements = "Projeto de extensão para graduandos da UniEVANGÉLICA e de instituições internacionais conveniadas, com 17 vagas. Em 2027.1: Medicina no internato (9º/10º períodos); Odontologia, Enfermagem e Psicologia a partir do 8º; Fisioterapia do 6º; Teologia do 3º. Há duas vagas para instituições internacionais conveniadas. Exige critérios acadêmicos, experiência em extensão, vacinação e preparação previstos no chamamento. Viagem prevista para 25/04 a 01/05/2027, sujeita às condições climáticas e de navegabilidade. Voluntários pagantes: confira custos, reunião e demais obrigações no documento oficial.";
    amount = "Bolsa parcial de extensão cobre hospedagem fluvial e terrestre; sem bolsa em dinheiro anunciada. Taxa de alimentação: R$ 500,00, sem reembolso em caso de desistência. Passagens aéreas por conta do participante e sujeitas à coordenação. Não é participação gratuita.";
    candidate = { applicantType: "undergraduate_student", benefitType: "extension_scholarship", categories: ["pesquisa", "bolsas"],
      nationallyEligible: false, countryCode: null, stateCode: null, cityName: null, geographicScopeKind: "unknown",
      eventStartsAt: "2027-04-25", officialDocumentUrl: AMAZONIA_DOCUMENT_URL };
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const proof = (excerpt: string) => ({ source_url: url, excerpt });
  const evidence: OpportunityCandidate["evidenceJson"] = {
    deadline_at: proof(source.id === CPS_ROBOCODE_ID ? "Fase local: inscrições, batalhas e envio de relatório até 30/10/2026."
      : source.id === IFMG_JECT_ID ? "Inscrições abertas até dia 20 de outubro; realização de 27 a 29 de outubro de 2026."
        : source.id === AMAZONIA_ID ? "Inscrições de 15 a 30 de outubro de 2026." : "Inscrições de 22 de setembro a 23 de outubro de 2026."),
    opportunity_status: proof(terminal ?? (registration ? "Chamada de inscrição vigente na página oficial da edição." : "Chamada de inscrição ausente na página oficial.")),
    requirements: proof(requirements), conditions: proof(amount),
  };
  if (candidate.nationallyEligible) evidence.national_scope = proof("Estudantes regularmente matriculados em cursos de graduação no Brasil; competição on-line.");
  if (candidate.eventStartsAt) evidence.event_start = proof(source.id === FGV_DATATHON_ID ? "Abertura do desafio: 30 de outubro de 2026, às 9h (horário de Brasília)."
    : source.id === AMAZONIA_ID ? "Viagem prevista de 25 de abril a 1º de maio de 2027, sujeita a alterações." : "Realização de 27 a 29 de outubro de 2026.");
  if (source.id === AMAZONIA_ID) evidence.official_document = { source_url: AMAZONIA_DOCUMENT_URL, excerpt: "Chamamento 2027; inscrição 15–30/10/26, voluntários pagantes, hospedagem parcial, taxa de alimentação R$ 500,00 e passagens próprias." };
  return [{ ...candidate, officialSourceId: source.id, title, institution: source.institutionName,
    sourcePageUrl: url, applicationUrl: url, applicationRoute: "direct_student_application", isCourse: false,
    deadlineAt: deadline, deadlinePrecision: "date_only", opportunityStatus: terminal ?? (registration && today <= deadline ? "open" : "closed"),
    reviewStatus: "needs_information", extractionMethod: "html", requirementsText: requirements, amountText: amount,
    evidenceJson: evidence, contentHash: crypto.createHash("sha256").update(`${source.id}\n${text}\n${clean(supplement)}`).digest("hex"),
  }];
}
