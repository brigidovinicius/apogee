import {
  BRAZILIAN_STATE_CODES,
  SEARCH_CITIES_BY_STATE,
  normalizeBrazilianLocation,
  type BrazilianStateCode,
} from "@/lib/opportunities/location";

export const OPPORTUNITY_KINDS = ["Bolsa", "Auxílio", "Estágio", "Intercâmbio", "Curso", "Prêmio", "Fomento", "Programa"] as const;
export const EDUCATION_LEVELS = ["Ensino médio", "Graduação", "Pós-graduação", "Público diverso"] as const;
export const OPPORTUNITY_CATEGORIES = [
  { id: "formacao", label: "Formação e aprendizagem" },
  { id: "bolsas", label: "Bolsas e apoios financeiros" },
  { id: "intercambios", label: "Intercâmbios" },
  { id: "competicoes", label: "Competições e hackathons" },
  { id: "pesquisa", label: "Pesquisa e inovação" },
  { id: "carreira", label: "Carreira e experiência" },
  { id: "eventos", label: "Eventos e comunidades" },
] as const;

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number]["id"];
export const isOpportunityCategory = (value: unknown): value is OpportunityCategory =>
  typeof value === "string" && OPPORTUNITY_CATEGORIES.some((category) => category.id === value);

/** Campos que podem compor a prévia pública do Radar. */
export type OpportunityPreview = {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  level: EducationLevel;
  categories?: OpportunityCategory[];
};

/** Dados públicos do catálogo; controles administrativos permanecem no servidor. */
export type StudentOpportunity = OpportunityPreview & {
  location: string;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  nationallyEligible?: boolean;
  eligibility: string;
  benefit: string;
  summary: string;
  deadline: string | null;
  deadlineLabel: string;
  officialUrl: string;
  verifiedAt: string;
  verificationTimestamp?: string;
  opportunityStatus?: "open" | "upcoming";
  verificationMethod?: "automatic" | "admin";
};

export function mergeOpportunities(
  curated: readonly StudentOpportunity[],
  radar: readonly StudentOpportunity[],
): StudentOpportunity[] {
  const results = new Map<string, StudentOpportunity>();
  for (const opportunity of [...curated, ...radar]) {
    const key = `${opportunity.officialUrl.toLowerCase()}\u0000${opportunity.title.toLocaleLowerCase("pt-BR")}`;
    results.set(key, opportunity);
  }
  return [...results.values()];
}

export type OpportunityFilters = {
  category?: OpportunityCategory | null;
  kind: OpportunityKind | null;
  level: EducationLevel | null;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  query?: string | null;
};

export const EMPTY_OPPORTUNITY_FILTERS: OpportunityFilters = {
  category: null,
  kind: null,
  level: null,
  stateCode: null,
  cityName: null,
  query: null,
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
  const hasNational = openOpportunities.some((opportunity) => opportunity.nationallyEligible === true);

  return {
    kinds: OPPORTUNITY_KINDS.filter((kind) =>
      openOpportunities.some((opportunity) => opportunity.kind === kind),
    ),
    levels: EDUCATION_LEVELS.filter((level) =>
      openOpportunities.some((opportunity) => opportunity.level === level),
    ),
    states: BRAZILIAN_STATE_CODES.filter((stateCode) =>
      openOpportunities.some((opportunity) => opportunity.stateCode === stateCode || opportunity.nationallyEligible === true),
    ),
    citiesByState: Object.fromEntries(
      BRAZILIAN_STATE_CODES.map((stateCode) => [
        stateCode,
        [...new Set([
          ...(hasNational ? SEARCH_CITIES_BY_STATE[stateCode] : []),
          ...(
          openOpportunities
            .filter((opportunity) => opportunity.stateCode === stateCode)
            .map((opportunity) => opportunity.cityName)
            .filter((cityName): cityName is string => cityName !== null)
          ),
        ])].sort((left, right) => left.localeCompare(right, "pt-BR")),
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
  const categoryValue = searchParams.get("categoria");
  const kindValue = searchParams.get("modalidade");
  const levelValue = searchParams.get("formacao");
  const location = normalizeBrazilianLocation({
    stateCode: searchParams.get("uf"),
    cityName: searchParams.get("cidade"),
  });
  const query = searchParams.get("busca")?.trim().slice(0, 100);

  return {
    ...(isOpportunityCategory(categoryValue) ? { category: categoryValue } : {}),
    kind: OPPORTUNITY_KINDS.find((kind) => kind === kindValue) ?? null,
    level: EDUCATION_LEVELS.find((level) => level === levelValue) ?? null,
    stateCode: location.status === "valid" ? location.location.stateCode : null,
    cityName: location.status === "valid" ? location.location.cityName : null,
    ...(query ? { query } : {}),
  };
}

export function setOpportunityFilterSearchParams(
  searchParams: URLSearchParams,
  filters: OpportunityFilters,
) {
  const values = {
    categoria: filters.category,
    modalidade: filters.kind,
    formacao: filters.level,
    uf: filters.stateCode,
    cidade: filters.stateCode ? filters.cityName : null,
    busca: filters.query?.trim().slice(0, 100) || null,
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
  const query = filters.query?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return sortByDeadline(opportunities)
    .filter((opportunity) => isOpportunityOpen(opportunity, today))
    .filter((opportunity) => !filters.category || opportunity.categories?.includes(filters.category))
    .filter((opportunity) => filters.kind === null || opportunity.kind === filters.kind)
    .filter((opportunity) => filters.level === null || opportunity.level === filters.level)
    .filter((opportunity) => filters.stateCode === null || opportunity.stateCode === filters.stateCode || opportunity.nationallyEligible === true)
    .filter((opportunity) => filters.cityName === null || (
      opportunity.nationallyEligible === true ||
      opportunity.stateCode === filters.stateCode && opportunity.cityName === filters.cityName
    ))
    .filter((opportunity) => !query || [opportunity.title, opportunity.organization,
      opportunity.eligibility, opportunity.benefit, opportunity.summary]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(query)));
}

export function countActiveOpportunityFilters(filters: OpportunityFilters) {
  return Number(Boolean(filters.category)) + Number(filters.kind !== null) + Number(filters.level !== null) +
    Number(filters.stateCode !== null) + Number(filters.cityName !== null) + Number(Boolean(filters.query?.trim()));
}
