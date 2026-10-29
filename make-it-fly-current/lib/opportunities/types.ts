import type { Discovery } from "./discovery";
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

/** One editorial category leads the card; other verified categories remain searchable. */
export const OPPORTUNITY_CATEGORY_PRIORITY = ["eventos", "competicoes", "pesquisa", "carreira", "bolsas", "intercambios", "formacao"] as const;
export function primaryOpportunityCategory(item: { categories?: readonly string[]; discovery?: Discovery }) {
  if (item.discovery?.primaryType) return item.discovery.primaryType;
  if (item.categories?.includes("competicoes")) return "competicoes";
  return OPPORTUNITY_CATEGORY_PRIORITY.find(category => item.categories?.includes(category)) ?? null;
}

export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number]["id"];
export const isOpportunityCategory = (value: unknown): value is OpportunityCategory =>
  typeof value === "string" && OPPORTUNITY_CATEGORIES.some((category) => category.id === value);

/** Campos que podem compor a prévia pública do Radar. */
export const AREAS = { matematica:'Matemática', fisica:'Física', quimica:'Química', biologia:'Biologia', astronomia:'Astronomia e espaço', clima:'Terra e clima', ambiente:'Meio ambiente', saude:'Saúde', neurociencia:'Neurociência', tecnologia:'Tecnologia', ia:'Inteligência artificial', robotica:'Robótica e engenharia', dados:'Dados', humanas:'Humanas e história', geografia:'Geografia', linguas:'Línguas', educacao:'Educação', artes:'Artes e design', comunicacao:'Comunicação', negocios:'Negócios', direito:'Direito e políticas públicas', 'relacoes-internacionais':'Relações internacionais', esportes:'Esportes' };

export type OpportunityPreview = {
  id: string;
  title: string;
  organization: string;
  kind: OpportunityKind;
  level: EducationLevel;
  categories?: OpportunityCategory[];
};

export type OpportunityFinancials = {
  benefits: { label: "REMUNERAÇÃO" | "BOLSA" | "PREMIAÇÃO" | "PREMIAÇÃO TOTAL"; text: string }[];
  costs: string[];
  notes: string[];
};

/** Dados públicos do catálogo; controles administrativos permanecem no servidor. */
export type StudentOpportunity = OpportunityPreview & {
  discovery?: Discovery;
  /** Derived conservatively by the server from the verified source fields. */
  participationFormat?: "online" | "presencial" | "hibrido" | null;
  explicitlyUnpaid?: boolean;
  entranceExam?: boolean;
  editorialNature?: "extracurricular" | "formal_admission" | "unclassified";
  editorialFocus?: "event_or_competition" | "extracurricular_project" | null;
  financials?: OpportunityFinancials;
  admissionProcess?: { id: string; title: string } | null;
  location: string;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  nationallyEligible?: boolean;
  eligibility: string;
  benefit: string;
  summary: string;
  /** Original timestamp retained when the source specifies a time. */
  deadlineAt?: string | null;
  /** Confirmed event start: YYYY-MM-DD or ISO timestamp with timezone. */
  eventStartsAt?: string | null;
  deadlineUnknown?: boolean;
  alertsAvailable?: boolean;
  deadline: string | null;
  deadlineLabel: string;
  officialUrl: string;
  verifiedAt: string;
  verificationTimestamp?: string;
  opportunityStatus?: "open" | "upcoming" | "closed" | "result_published";
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
  area?: keyof typeof AREAS | null;
  category?: OpportunityCategory | "vestibular" | null;
  kind: OpportunityKind | null;
  level: EducationLevel | null;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
  query?: string | null;
  format?: "online" | "presencial" | "hibrido" | null;
  scope?: "nacional" | null;
  benefit?: "remunerado" | "nao-remunerado" | "premiacao" | "gratuito" | null;
  deadlineWindow?: "7dias" | "30dias" | "continuo" | "nao-informado" | "abertas" | null;
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

export function isOpportunityOpen(opportunity: StudentOpportunity, today = dateInBrazil(), now = Date.now()) {
  if (opportunity.opportunityStatus && !["open", "upcoming"].includes(opportunity.opportunityStatus)) return false;
  if (opportunity.deadlineAt && Date.parse(opportunity.deadlineAt) < now) return false;
  if (opportunity.deadlineUnknown && opportunity.eventStartsAt) {
    const start = opportunity.eventStartsAt;
    if (start.length === 10 ? start < today : Date.parse(start) <= now) return false;
  }
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
  now = Date.now(),
  includeClosed = false,
): OpportunityFilterOptions {
  const openOpportunities = opportunities.filter((opportunity) =>
    includeClosed || isOpportunityOpen(opportunity, today, now),
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
    ...(isOpportunityCategory(categoryValue) || categoryValue === "vestibular" ? { category: categoryValue } : {}),
    kind: OPPORTUNITY_KINDS.find((kind) => kind === kindValue) ?? null,
    level: EDUCATION_LEVELS.find((level) => level === levelValue) ?? null,
    stateCode: location.status === "valid" ? location.location.stateCode : null,
    cityName: location.status === "valid" ? location.location.cityName : null,
    ...(query ? { query } : {}),
    ...(Object.hasOwn(AREAS, searchParams.get("area") ?? "") ? { area: searchParams.get("area") as keyof typeof AREAS } : {}),
    ...(["online", "presencial", "hibrido"].includes(searchParams.get("formato") ?? "") ? { format: searchParams.get("formato") as OpportunityFilters["format"] } : {}),
    ...(searchParams.get("abrangencia") === "nacional" ? { scope: "nacional" as const } : {}),
    ...(["remunerado", "nao-remunerado", "premiacao", "gratuito"].includes(searchParams.get("beneficio") ?? "") ? { benefit: searchParams.get("beneficio") as OpportunityFilters["benefit"] } : {}),
    ...(["7dias", "30dias", "continuo", "nao-informado", "abertas"].includes(searchParams.get("prazo") ?? "") ? { deadlineWindow: searchParams.get("prazo") as OpportunityFilters["deadlineWindow"] } : {}),
  };
}

export function setOpportunityFilterSearchParams(
  searchParams: URLSearchParams,
  filters: OpportunityFilters,
) {
  const values = {
    area: filters.area,
    categoria: filters.category,
    modalidade: filters.kind,
    formacao: filters.level,
    uf: filters.stateCode,
    cidade: filters.stateCode ? filters.cityName : null,
    busca: filters.query?.trim().slice(0, 100) || null,
    formato: filters.format,
    abrangencia: filters.scope,
    beneficio: filters.benefit,
    prazo: filters.deadlineWindow,
  };

  for (const [key, value] of Object.entries(values)) {
    if (value) searchParams.set(key, value);
    else searchParams.delete(key);
  }
  return searchParams;
}

/** Source metadata or an explicit entrance rule; never the institution or audience alone. */
export function isEntranceExamOpportunity(opportunity: StudentOpportunity) {
  return Boolean(opportunity.admissionProcess || opportunity.entranceExam);
}

export function matchesOpportunityBenefit(item: StudentOpportunity, value: OpportunityFilters["benefit"]) {
  if (!value) return true;
  if (value === "remunerado") return Boolean(item.financials?.benefits.length);
  if (value === "nao-remunerado") return item.explicitlyUnpaid === true;
  if (value === "premiacao") return Boolean(item.financials?.benefits.some(benefit => benefit.label.startsWith("PREMIAÇÃO")));
  return Boolean(item.financials?.costs.some(cost => /^(?:inscriç(?:ão|ões)|participação|curso)\s+gratuit[oa]s?\b|^sem taxa de inscrição\b/iu.test(cost)));
}

export function matchesOpportunityDeadline(item: StudentOpportunity, value: OpportunityFilters["deadlineWindow"], today: string) {
  if (!value) return true;
  if (value === "abertas") return item.opportunityStatus === "open";
  if (value === "continuo") return !item.deadline && !item.deadlineUnknown;
  if (value === "nao-informado") return item.deadlineUnknown === true;
  const days = item.deadline ? (Date.parse(item.deadline) - Date.parse(today)) / 86_400_000 : Infinity;
  return days >= 0 && days <= (value === "7dias" ? 7 : 30);
}

export function filterOpportunities(
  opportunities: readonly StudentOpportunity[],
  filters: OpportunityFilters,
  today = dateInBrazil(),
  preserveOrder = false,
  includeAllAdmissions = false,
  now = Date.now(),
  includeClosed = false,
) {
  const normalizeSearch = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  const query = normalizeSearch(filters.query?.trim() ?? "");
  return (preserveOrder ? [...opportunities] : sortByDeadline(opportunities))
    .filter((opportunity) => includeClosed || isOpportunityOpen(opportunity, today, now))
    .filter((opportunity) => {
      if (filters.category === "vestibular") return isEntranceExamOpportunity(opportunity);
      if (!includeAllAdmissions && isEntranceExamOpportunity(opportunity)) return false;
      return !filters.category || opportunity.categories?.includes(filters.category);
    })
    .filter((opportunity) => !filters.area || opportunity.discovery?.areas.includes(filters.area))
    .filter((opportunity) => filters.kind === null || opportunity.kind === filters.kind)
    .filter((opportunity) => filters.level === null || opportunity.level === filters.level)
    .filter((opportunity) => filters.stateCode === null || opportunity.stateCode === filters.stateCode || opportunity.nationallyEligible === true)
    .filter((opportunity) => filters.cityName === null || (
      opportunity.nationallyEligible === true ||
      opportunity.stateCode === filters.stateCode && opportunity.cityName === filters.cityName
    ))
    .filter((opportunity) => !filters.format || opportunity.participationFormat === filters.format)
    .filter((opportunity) => !filters.scope || opportunity.nationallyEligible === true)
    .filter((opportunity) => matchesOpportunityBenefit(opportunity, filters.benefit))
    .filter((opportunity) => matchesOpportunityDeadline(opportunity, filters.deadlineWindow, today))
    .filter((opportunity) => !query || [opportunity.title, opportunity.organization,
      opportunity.eligibility, opportunity.benefit, opportunity.summary]
      .some((value) => normalizeSearch(value).includes(query)));
}

export function countActiveOpportunityFilters(filters: OpportunityFilters) {
  return Number(Boolean(filters.area)) + Number(Boolean(filters.category)) + Number(filters.kind !== null) + Number(filters.level !== null) +
    Number(filters.stateCode !== null) + Number(filters.cityName !== null) + Number(Boolean(filters.query?.trim())) + Number(Boolean(filters.format)) + Number(Boolean(filters.scope)) + Number(Boolean(filters.benefit)) + Number(Boolean(filters.deadlineWindow));
}
