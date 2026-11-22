import "server-only";
import { createOpportunitySearch, normalizeOpportunitySearch } from "./search";
import type { CanonicalBrazilianLocation } from "./location";
import { technologyEventOrganizer } from "./technology-event-organizers";
import { primaryOpportunityCategory, type OpportunityFilters, type StudentOpportunity } from "./types";

// Preferred activities and confirmed prizes exceed tie-breakers and diversity penalties.
// Admissions never receive these boosts; source amounts do not determine relevance.
export const DEFAULT_RANKING = Object.freeze({
  focusedActivity: 400, extracurricular: 300, unclassified: 100, formalAdmission: 0,
  preferredActivity: 200, confirmedPrize: 100, technologyBusiness: 8, thisWeekEvent: 10, upcomingEvent: 5,
  technologyEvent: 65, technologyOrganizer: 110, technologyProject: 160,
  sameCity: 380, sameState: 220, accessibleOnline: 45,
  confirmedBenefit: 6, open: 4, usefulDeadline: 3, recentVerification: 2,
  organizationRepeat: 4, organizationPenaltyCap: 40,
  categoryRepeat: 1, categoryPenaltyCap: 12,
  dailyRotation: 0.9,
});
export type RankingConfig = { [Key in keyof typeof DEFAULT_RANKING]: number };

const technologyAreas = new Set(["tecnologia", "ia", "robotica", "dados"]);
const technologyTheme = /\b(?:tecnolog(?:ia|ias|ico|ica|icos|icas)|tech|inteligencia artificial|artificial intelligence|ia|ai|robotica|robotics|software|programacao|computacao|ciberseguranca|cybersecurity|fintech|edtech|govtech|web3|blockchain|machine learning|aprendizado de maquina|computacao em nuvem|cloud computing|engenharia de dados|data\s*centers?|devops)\b/u;
const businessTheme = /\b(?:empreendedor(?:ismo|a|as|es)?|inovacao|innovation|startups?|negocios?|business)\b/u;

function eventTime(item: StudentOpportunity) {
  const value = item.eventStartsAt;
  const time = value ? Date.parse(value.length === 10 ? `${value}T00:00:00-03:00` : value) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}

const brazilDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
function dailyRotation(id: string, now: number) {
  let hash = 2166136261;
  for (const character of `${brazilDay.format(now)}:${id}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0) / 0x100000000;
}

function editorialHighlights(item: StudentOpportunity) {
  if (item.admissionProcess || item.entranceExam || item.editorialNature === "formal_admission") {
    return { event: false, preferred: false, prize: false, business: false, technology: false, companyEvent: false, techProject: false };
  }
  const categories = item.categories ?? [];
  const competition = categories.includes("competicoes") || item.discovery?.primaryType === "competicoes";
  const hackathon = item.discovery?.subtype === "hackathon" || /\bhacka(?:thon|ton)s?\b/iu.test(item.title ?? "");
  const event = competition || hackathon || categories.includes("eventos") || item.discovery?.primaryType === "eventos";
  // An audited prize may be products or services. Its ranking boost does not
  // turn it into a cash benefit or change the separately verified financials.
  const prize = event && (item.kind === "Prêmio" || Boolean(item.financials?.benefits.some(benefit => ["PREMIAÇÃO", "PREMIAÇÃO TOTAL"].includes(benefit.label))));
  const title = normalizeOpportunitySearch(item.title ?? "");
  const areas = item.discovery?.areas ?? [];
  const technology = areas.some(area => technologyAreas.has(area)) || technologyTheme.test(title);
  const businessArea = areas.includes("negocios");
  const companyEvent = event && technologyEventOrganizer(item);
  const techProject = item.editorialNature === "extracurricular" && item.editorialFocus === "extracurricular_project" && technology;
  const preferred = event && (competition || hackathon || technology || businessArea || businessTheme.test(title) || prize || companyEvent);
  return { event, preferred, prize, business: event && businessArea && technology, technology, companyEvent, techProject };
}

export function canRankByLocation(filters: OpportunityFilters) {
  return !filters.stateCode && !filters.cityName && !filters.scope && filters.format !== "online" &&
    !filters.kind && !filters.workplace && !filters.brazilJobs &&
    (!filters.category || filters.category === "eventos" || filters.category === "competicoes" || filters.category === "pesquisa");
}

function locationScore(item: StudentOpportunity, location: CanonicalBrazilianLocation, config: RankingConfig) {
  if (!location.stateCode) return 0;
  if (item.participationFormat === "online") return config.accessibleOnline;
  if (item.stateCode !== location.stateCode) {
    return item.participationFormat === "hibrido" ? config.accessibleOnline : 0;
  }
  const city = normalizeOpportunitySearch(location.cityName ?? "");
  return city && city === normalizeOpportunitySearch(item.cityName ?? "") ? config.sameCity : config.sameState;
}

export function opportunityScore(item: StudentOpportunity, filters: OpportunityFilters,
  now: number, config: RankingConfig = DEFAULT_RANKING, location?: CanonicalBrazilianLocation) {
  const explicitSubject = Boolean(filters.area || filters.kind || filters.query?.trim());
  const prioritizeActivities = !filters.category && !explicitSubject;
  const prioritizeHighlights = !explicitSubject && (!filters.category || ["eventos", "competicoes"].includes(filters.category));
  const highlights = editorialHighlights(item);
  const nearby = location && canRankByLocation(filters) &&
    (highlights.event && (highlights.preferred || item.editorialNature === "extracurricular") || highlights.techProject)
    ? locationScore(item, location, config) : 0;
  const nature = item.admissionProcess || item.editorialNature === "formal_admission" ? config.formalAdmission
    : item.editorialNature === "extracurricular" ? item.editorialFocus ? config.focusedActivity : config.extracurricular
      : config.unclassified;
  const days = item.deadline ? (Date.parse(`${item.deadline}T23:59:59-03:00`) - now) / 86_400_000 : Infinity;
  const startsIn = item.eventStartsAt ? (Date.parse(item.eventStartsAt.length === 10 ? `${item.eventStartsAt}T00:00:00-03:00` : item.eventStartsAt) - now) / 86_400_000 : Infinity;
  return (item.employment?.roleFamily === "fde" && item.employment.workplace === "remote" && item.employment.brazilEligibility === "confirmed" && (filters.category === "carreira" || filters.kind === "Emprego" || filters.workplace || filters.brazilJobs) ? 200 : 0) +
    (prioritizeActivities ? nature : 0) +
    nearby +
    (prioritizeHighlights && highlights.event && highlights.technology ? config.technologyEvent : 0) +
    (prioritizeHighlights && highlights.companyEvent ? config.technologyOrganizer : 0) +
    (prioritizeActivities && highlights.techProject ? config.technologyProject : 0) +
    (prioritizeHighlights && item.editorialFocus === 'event_or_competition' ? dailyRotation(item.id, now) * config.dailyRotation : 0) +
    (prioritizeHighlights && highlights.preferred ? config.preferredActivity : 0) +
    (prioritizeHighlights && highlights.prize ? config.confirmedPrize : 0) +
    (prioritizeHighlights && highlights.business ? config.technologyBusiness : 0) +
    (prioritizeHighlights && highlights.preferred && startsIn >= 0 && startsIn <= 30 ? startsIn <= 7 ? config.thisWeekEvent : config.upcomingEvent : 0) +
    (item.financials?.benefits.length ? config.confirmedBenefit : 0) +
    (item.opportunityStatus === "open" ? config.open : 0) +
    (days >= 0 && days <= 30 ? config.usefulDeadline : 0) +
    (now - Date.parse(item.verificationTimestamp ?? item.verifiedAt) >= 0 &&
      now - Date.parse(item.verificationTimestamp ?? item.verifiedAt) <= 7 * 86_400_000 ? config.recentVerification : 0);
}

/** Candidates in one organization/category bucket share the same dynamic penalty.
 * Only the head of each sorted bucket can win, avoiding rescanning every course. */
export function rankOpportunities(items: readonly StudentOpportunity[], filters: OpportunityFilters,
  now = Date.now(), config: RankingConfig = DEFAULT_RANKING, location?: CanonicalBrazilianLocation) {
  const search = createOpportunitySearch(filters.query);
  type Candidate = { item: StudentOpportunity; relevance: number; score: number; organization: string; category: string };
  type Bucket = { candidates: Candidate[]; index: number };
  const groups = new Map<string, Bucket>();
  const compare = (left: Candidate, right: Candidate) => right.relevance - left.relevance || right.score - left.score ||
    (left.item.deadline ?? "9999-12-31").localeCompare(right.item.deadline ?? "9999-12-31") ||
    eventTime(left.item) - eventTime(right.item) || left.item.id.localeCompare(right.item.id);
  for (const item of items) {
    const organization = item.organization.split(/;\s*conteúdo:/iu)[0].trim().toLocaleLowerCase("pt-BR");
    const category = primaryOpportunityCategory(item) ?? "";
    const key = `${organization}\u0000${category}`;
    const bucket = groups.get(key) ?? { candidates: [], index: 0 };
    bucket.candidates.push({ item, organization, category, relevance: search.score(item), score: opportunityScore(item, filters, now, config, location) });
    groups.set(key, bucket);
  }
  const buckets = [...groups.values()];
  for (const bucket of buckets) bucket.candidates.sort(compare);
  const ordered: StudentOpportunity[] = [];
  const organizations = new Map<string, number>();
  const categories = new Map<string, number>();
  const adjusted = (candidate: Candidate) => candidate.score -
    Math.min(config.organizationPenaltyCap, (organizations.get(candidate.organization) ?? 0) * config.organizationRepeat) -
    Math.min(config.categoryPenaltyCap, (categories.get(candidate.category) ?? 0) * config.categoryRepeat);
  while (buckets.length) {
    let best = 0;
    for (let index = 1; index < buckets.length; index++) {
      const left = buckets[index].candidates[buckets[index].index];
      const right = buckets[best].candidates[buckets[best].index];
      const delta = left.relevance - right.relevance || adjusted(left) - adjusted(right);
      if (delta > 0 || delta === 0 && compare({ ...left, score: 0 }, { ...right, score: 0 }) < 0) best = index;
    }
    const bucket = buckets[best];
    const candidate = bucket.candidates[bucket.index++];
    ordered.push(candidate.item);
    organizations.set(candidate.organization, (organizations.get(candidate.organization) ?? 0) + 1);
    categories.set(candidate.category, (categories.get(candidate.category) ?? 0) + 1);
    if (bucket.index === bucket.candidates.length) buckets.splice(best, 1);
  }
  return ordered;
}
