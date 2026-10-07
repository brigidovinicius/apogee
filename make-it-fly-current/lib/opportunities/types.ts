export const OPPORTUNITY_KINDS = ["Bolsa", "Programa", "Intercâmbio"] as const;
export const EDUCATION_LEVELS = ["Ensino médio", "Graduação", "Pós-graduação", "Público diverso"] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

/** Campos que podem compor a prévia pública do Radar. */
export type OpportunityPreview = {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  level: EducationLevel;
};

/** Dados editoriais completos: só podem cruzar a fronteira para membros autenticados. */
export type StudentOpportunity = OpportunityPreview & {
  location: string;
  eligibility: string;
  benefit: string;
  summary: string;
  deadline: string | null;
  deadlineLabel: string;
  officialUrl: string;
  verifiedAt: string;
};

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
