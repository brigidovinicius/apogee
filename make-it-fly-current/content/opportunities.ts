export const OPPORTUNITY_KINDS = ["Bolsa", "Programa", "Intercâmbio"] as const;
export const EDUCATION_LEVELS = ["Ensino médio", "Graduação", "Pós-graduação", "Público diverso"] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export type StudentOpportunity = {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  level: EducationLevel;
  location: string;
  eligibility: string;
  benefit: string;
  summary: string;
  deadline: string | null;
  deadlineLabel: string;
  officialUrl: string;
  verifiedAt: string;
};

/**
 * Catálogo editorial da Apogee. Cada item deve apontar para a página oficial
 * da chamada e só pode permanecer publicado enquanto estiver vigente.
 */
export const STUDENT_OPPORTUNITIES: readonly StudentOpportunity[] = [
  {
    id: "promaips-2027-1",
    title: "PROMAIPS — Mobilidade Acadêmica Internacional",
    organization: "Centro Paula Souza · ARInter",
    kind: "Intercâmbio",
    level: "Graduação",
    location: "Fatecs · exterior",
    eligibility:
      "Estudantes de Fatecs presenciais, maiores de 18 anos, com PPI entre 40% e 80%, conforme edital.",
    benefit: "Isenção de matrícula e mensalidades acadêmicas por um semestre.",
    summary:
      "Mobilidade para instituições estrangeiras parceiras no primeiro semestre de 2027.",
    deadline: "2026-10-07",
    deadlineLabel: "Inscrições até 7 de outubro",
    officialUrl: "https://arinter.cps.sp.gov.br/promaips/",
    verifiedAt: "2026-10-01",
  },
  {
    id: "ufcspa-proext-2026",
    title: "Bolsa de extensão — Oficinas de Primeiros Socorros",
    organization: "UFCSPA",
    kind: "Bolsa",
    level: "Graduação",
    location: "Porto Alegre · RS",
    eligibility: "Estudantes elegíveis à seleção no Sistema de Bolsas da UFCSPA.",
    benefit: "Bolsa mensal de R$ 700 por nove meses.",
    summary:
      "Uma vaga para projeto de extensão voltado a escolas públicas de Porto Alegre.",
    deadline: "2026-10-01",
    deadlineLabel: "Inscrições até 1º de outubro",
    officialUrl:
      "https://ufcspa.edu.br/noticias/noticias-para-comunidade-interna/7809-edital-complementar-abre-selecao-de-bolsista-para-projeto-de-extensao",
    verifiedAt: "2026-10-01",
  },
  {
    id: "ifmt-juina-extensao-2026",
    title: "Bolsas de extensão — projetos de biodiversidade e educação",
    organization: "IFMT · Campus Juína",
    kind: "Bolsa",
    level: "Ensino médio",
    location: "Juína · MT",
    eligibility:
      "Estudantes de cursos técnicos do IFMT Campus Juína, conforme perfil socioeconômico do edital.",
    benefit: "Seis bolsas de R$ 400 mensais, de novembro de 2026 a agosto de 2027.",
    summary:
      "Seleção para três projetos de extensão nas áreas de biodiversidade, meio ambiente e educação.",
    deadline: "2026-10-09",
    deadlineLabel: "Inscrições de 5 a 9 de outubro",
    officialUrl:
      "https://jna.ifmt.edu.br/ifmt-juina-abre-edital-com-6-vagas-para-projetos-de-extensao-com-bolsas-de-r-400/",
    verifiedAt: "2026-10-01",
  },
  {
    id: "ifsuldeminas-mobilidade-2027-1",
    title: "Mobilidade Estudantil Internacional — América do Sul",
    organization: "IFSULDEMINAS",
    kind: "Intercâmbio",
    level: "Graduação",
    location: "Argentina, Colômbia e Peru",
    eligibility: "Estudantes de cursos superiores correspondentes do IFSULDEMINAS.",
    benefit:
      "Auxílios para viagem, seguro, passaporte e despesas, além de residência e alimentação no destino.",
    summary:
      "Quatro vagas para mobilidade presencial de um semestre em instituições da América do Sul.",
    deadline: "2026-10-15",
    deadlineLabel: "Inscrições até 15 de outubro",
    officialUrl:
      "https://portal.ifsuldeminas.edu.br/index.php/pro-reitoria-extensao/editais-proex/159-editais-intercambio/7655-edital-222-2026",
    verifiedAt: "2026-10-01",
  },
  {
    id: "rio-verde-bolsa-universitaria-2026",
    title: "Programa Bolsa Universitária",
    organization: "Prefeitura de Rio Verde · GO",
    kind: "Bolsa",
    level: "Graduação",
    location: "Rio Verde · GO",
    eligibility: "Estudantes que atendam aos critérios da Secretaria Municipal de Assistência Social.",
    benefit: "Bolsa universitária; consulte as condições e documentos no atendimento oficial.",
    summary:
      "Programa municipal com inscrições presenciais divulgadas pela Universidade de Rio Verde.",
    deadline: "2026-10-16",
    deadlineLabel: "Inscrições de 1º a 16 de outubro",
    officialUrl: "https://www.unirv.edu.br/ver_noticias.php?codabr=20168",
    verifiedAt: "2026-10-01",
  },
  {
    id: "praia-grande-bolsa-ensino-medio-2026",
    title: "PG — Bolsa Estudante do Ensino Médio",
    organization: "Prefeitura de Praia Grande · SP",
    kind: "Programa",
    level: "Ensino médio",
    location: "Praia Grande · SP",
    eligibility:
      "Alunos do ensino médio público integral de Praia Grande que atendam aos critérios de residência, renda e CadÚnico.",
    benefit: "Auxílio financeiro para apoiar a permanência escolar.",
    summary:
      "Programa municipal para estudantes em situação de vulnerabilidade socioeconômica.",
    deadline: "2026-11-02",
    deadlineLabel: "Inscrições até 2 de novembro",
    officialUrl:
      "https://www2.praiagrande.sp.gov.br/pagina-introdutoria/bolsa-estudante-do-ensino-medio?nocache=1788319333",
    verifiedAt: "2026-10-01",
  },
  {
    id: "pe-de-meia-licenciaturas-2026",
    title: "Pé-de-Meia Licenciaturas",
    organization: "CAPES · MEC",
    kind: "Programa",
    level: "Graduação",
    location: "Brasil",
    eligibility:
      "Estudantes de licenciaturas presenciais com alto desempenho no Enem, ingressantes por SiSU, Prouni ou Fies, conforme edital.",
    benefit: "R$ 700 mensais e R$ 350 mensais como incentivo à docência em poupança.",
    summary:
      "Apoio financeiro e acadêmico para a formação de futuros professores da educação básica.",
    deadline: "2026-12-19",
    deadlineLabel: "Pré-inscrição em fluxo contínuo até 19 de dezembro",
    officialUrl:
      "https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/educacao-basica/pe-de-meia-licenciaturas",
    verifiedAt: "2026-10-01",
  },
  {
    id: "bolsa-permanencia-indigena-quilombola",
    title: "Programa Bolsa Permanência",
    organization: "MEC · FNDE",
    kind: "Bolsa",
    level: "Graduação",
    location: "Brasil",
    eligibility: "Estudantes indígenas e quilombolas, conforme regras e documentação do programa.",
    benefit: "Bolsa mensal de R$ 1.400, após homologação e autorização do programa.",
    summary:
      "Inscrições em fluxo contínuo no sistema oficial do Programa Bolsa Permanência.",
    deadline: null,
    deadlineLabel: "Inscrições em fluxo contínuo",
    officialUrl:
      "https://www.ifto.edu.br/noticias/bolsa-permanencia-inscricoes-em-fluxo-continuo-para-estudantes-indigenas-e-quilombolas",
    verifiedAt: "2026-10-01",
  },
] as const;

export function dateInBrazil(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isOpportunityOpen(opportunity: StudentOpportunity, today = dateInBrazil()) {
  return opportunity.deadline === null || opportunity.deadline >= today;
}

export function sortByDeadline(opportunities: readonly StudentOpportunity[]) {
  return [...opportunities].sort((left, right) => {
    if (left.deadline === null) return 1;
    if (right.deadline === null) return -1;
    return left.deadline.localeCompare(right.deadline);
  });
}
