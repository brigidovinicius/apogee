import "server-only";
import { primaryOpportunityCategory, type OpportunityFilters, type StudentOpportunity } from "./types";

// Preferred activities and confirmed prizes exceed tie-breakers and diversity penalties.
// Admissions never receive these boosts; source amounts do not determine relevance.
export const DEFAULT_RANKING = Object.freeze({
  focusedActivity: 400, extracurricular: 300, unclassified: 100, formalAdmission: 0,
  preferredActivity: 200, confirmedPrize: 100, thisWeekEvent: 10, upcomingEvent: 5,
  confirmedBenefit: 6, open: 4, usefulDeadline: 3, recentVerification: 2,
  organizationRepeat: 4, organizationPenaltyCap: 40,
  categoryRepeat: 1, categoryPenaltyCap: 12,
});
export type RankingConfig = { [Key in keyof typeof DEFAULT_RANKING]: number };

const preferredAreas = new Set(["tecnologia", "ia", "robotica", "dados", "negocios"]);
const preferredTheme = /\b(?:tecnolog(?:ia|ias|ico|ica|icos|icas)|empreendedor(?:ismo|a|as|es)?|inovacao|innovation|startups?|negocios?|business|deep\s*tech|data\s*centers?|inteligencia artificial|ia|robotica|software|programacao|computacao|ciberseguranca|fintech|edtech|govtech|web3|blockchain|machine learning)\b/u;

function eventTime(item: StudentOpportunity) {
  const value = item.eventStartsAt;
  const time = value ? Date.parse(value.length === 10 ? `${value}T00:00:00-03:00` : value) : NaN;
  return Number.isFinite(time) ? time : Infinity;
}

function editorialHighlights(item: StudentOpportunity) {
  if (item.admissionProcess || item.entranceExam || item.editorialNature === "formal_admission") {
    return { preferred: false, prize: false };
  }
  const categories = item.categories ?? [];
  const competition = categories.includes("competicoes") || item.discovery?.primaryType === "competicoes";
  const hackathon = item.discovery?.subtype === "hackathon" || /\bhacka(?:thon|ton)s?\b/iu.test(item.title ?? "");
  const event = competition || hackathon || categories.includes("eventos") || item.discovery?.primaryType === "eventos";
  // An audited prize may be products or services. Its ranking boost does not
  // turn it into a cash benefit or change the separately verified financials.
  const prize = event && (item.kind === "Prêmio" || Boolean(item.financials?.benefits.some(benefit => ["PREMIAÇÃO", "PREMIAÇÃO TOTAL"].includes(benefit.label))));
  const title = (item.title ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const theme = item.discovery?.areas.some(area => preferredAreas.has(area)) || preferredTheme.test(title);
  return { preferred: event && (competition || hackathon || theme || prize), prize };
}

export function opportunityScore(item: StudentOpportunity, filters: OpportunityFilters,
  now: number, config: RankingConfig = DEFAULT_RANKING) {
  const explicitSubject = Boolean(filters.area || filters.kind || filters.query?.trim());
  const prioritizeActivities = !filters.category && !explicitSubject;
  const prioritizeHighlights = !explicitSubject && (!filters.category || ["eventos", "competicoes"].includes(filters.category));
  const highlights = editorialHighlights(item);
  const nature = item.admissionProcess || item.editorialNature === "formal_admission" ? config.formalAdmission
    : item.editorialNature === "extracurricular" ? item.editorialFocus ? config.focusedActivity : config.extracurricular
      : config.unclassified;
  const days = item.deadline ? (Date.parse(`${item.deadline}T23:59:59-03:00`) - now) / 86_400_000 : Infinity;
  const startsIn = item.eventStartsAt ? (Date.parse(item.eventStartsAt.length === 10 ? `${item.eventStartsAt}T00:00:00-03:00` : item.eventStartsAt) - now) / 86_400_000 : Infinity;
  return (prioritizeActivities ? nature : 0) +
    (prioritizeHighlights && highlights.preferred ? config.preferredActivity : 0) +
    (prioritizeHighlights && highlights.prize ? config.confirmedPrize : 0) +
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
  now = Date.now(), config: RankingConfig = DEFAULT_RANKING) {
  type Candidate = { item: StudentOpportunity; score: number; organization: string; category: string };
  type Bucket = { candidates: Candidate[]; index: number };
  const groups = new Map<string, Bucket>();
  const compare = (left: Candidate, right: Candidate) => right.score - left.score ||
    (left.item.deadline ?? "9999-12-31").localeCompare(right.item.deadline ?? "9999-12-31") ||
    eventTime(left.item) - eventTime(right.item) || left.item.id.localeCompare(right.item.id);
  for (const item of items) {
    const organization = item.organization.split(/;\s*conteúdo:/iu)[0].trim().toLocaleLowerCase("pt-BR");
    const category = primaryOpportunityCategory(item) ?? "";
    const key = `${organization}\u0000${category}`;
    const bucket = groups.get(key) ?? { candidates: [], index: 0 };
    bucket.candidates.push({ item, organization, category, score: opportunityScore(item, filters, now, config) });
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
      const delta = adjusted(left) - adjusted(right);
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
