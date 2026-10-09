import {
  BRAZILIAN_STATE_CODES,
  normalizeBrazilianLocation,
  type BrazilianStateCode,
} from "@/lib/opportunities/location";

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
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  eligibility: string;
  benefit: string;
  summary: string;
  deadline: string | null;
  deadlineLabel: string;
  officialUrl: string;
  verifiedAt: string;
};

export type OpportunityFilters = {
  kind: OpportunityKind | null;
  level: EducationLevel | null;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
};

export const EMPTY_OPPORTUNITY_FILTERS: OpportunityFilters = {
  kind: null,
  level: null,
  stateCode: null,
  cityName: null,
};

export type OpportunityFilterOptions = {
  kinds: OpportunityKind[];
  levels: EducationLevel[];
  states: BrazilianStateCode[];
  citiesByState: Partial<Record<BrazilianStateCode, string[]>>;
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

export function getOpportunityFilterOptions(
  opportunities: readonly StudentOpportunity[],
  today = dateInBrazil(),
): OpportunityFilterOptions {
  const openOpportunities = opportunities.filter((opportunity) =>
    isOpportunityOpen(opportunity, today),
  );

  return {
    kinds: OPPORTUNITY_KINDS.filter((kind) =>
      openOpportunities.some((opportunity) => opportunity.kind === kind),
    ),
    levels: EDUCATION_LEVELS.filter((level) =>
      openOpportunities.some((opportunity) => opportunity.level === level),
    ),
    states: BRAZILIAN_STATE_CODES.filter((stateCode) =>
      openOpportunities.some((opportunity) => opportunity.stateCode === stateCode),
    ),
    citiesByState: Object.fromEntries(
      BRAZILIAN_STATE_CODES.map((stateCode) => [
        stateCode,
        [...new Set(
          openOpportunities
            .filter((opportunity) => opportunity.stateCode === stateCode)
            .map((opportunity) => opportunity.cityName)
            .filter((cityName): cityName is string => cityName !== null),
        )].sort((left, right) => left.localeCompare(right, "pt-BR")),
      ]).filter(([, cities]) => cities.length > 0),
    ) as Partial<Record<BrazilianStateCode, string[]>>,
  };
}

export function sanitizeOpportunityFilters(
  filters: OpportunityFilters,
  options: OpportunityFilterOptions,
): OpportunityFilters {
  const stateCode = filters.stateCode && options.states.includes(filters.stateCode)
    ? filters.stateCode
    : null;
  const cityName = stateCode && filters.cityName && options.citiesByState[stateCode]?.includes(filters.cityName)
    ? filters.cityName
    : null;

  return { ...filters, stateCode, cityName };
}

export function opportunityFiltersFromSearchParams(searchParams: URLSearchParams): OpportunityFilters {
  const kindValue = searchParams.get("modalidade");
  const levelValue = searchParams.get("formacao");
  const location = normalizeBrazilianLocation({
    stateCode: searchParams.get("uf"),
    cityName: searchParams.get("cidade"),
  });

  return {
    kind: OPPORTUNITY_KINDS.find((kind) => kind === kindValue) ?? null,
    level: EDUCATION_LEVELS.find((level) => level === levelValue) ?? null,
    stateCode: location.status === "valid" ? location.location.stateCode : null,
    cityName: location.status === "valid" ? location.location.cityName : null,
  };
}

export function setOpportunityFilterSearchParams(
  searchParams: URLSearchParams,
  filters: OpportunityFilters,
) {
  const values = {
    modalidade: filters.kind,
    formacao: filters.level,
    uf: filters.stateCode,
    cidade: filters.stateCode ? filters.cityName : null,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value) searchParams.set(key, value);
    else searchParams.delete(key);
  }
  return searchParams;
}

export function filterOpportunities(
  opportunities: readonly StudentOpportunity[],
  filters: OpportunityFilters,
  today = dateInBrazil(),
) {
  return sortByDeadline(opportunities)
    .filter((opportunity) => isOpportunityOpen(opportunity, today))
    .filter((opportunity) => filters.kind === null || opportunity.kind === filters.kind)
    .filter((opportunity) => filters.level === null || opportunity.level === filters.level)
    .filter((opportunity) => filters.stateCode === null || opportunity.stateCode === filters.stateCode)
    .filter((opportunity) => filters.cityName === null || (
      opportunity.stateCode === filters.stateCode && opportunity.cityName === filters.cityName
    ));
}

export function countActiveOpportunityFilters(filters: OpportunityFilters) {
  return Number(filters.kind !== null) + Number(filters.level !== null) +
    Number(filters.stateCode !== null) + Number(filters.cityName !== null);
}
