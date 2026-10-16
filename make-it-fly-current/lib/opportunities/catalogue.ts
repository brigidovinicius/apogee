import "server-only";
import { groupAdmissionProcesses } from "./admission-processes";
import { rankOpportunities } from "./ranking";
import { EMPTY_OPPORTUNITY_FILTERS, OPPORTUNITY_CATEGORIES, dateInBrazil, filterOpportunities,
  getOpportunityFilterOptions, opportunityFiltersFromSearchParams, sanitizeOpportunityFilters,
  type OpportunityCategory, type OpportunityFilterOptions, type OpportunityFilters, type StudentOpportunity } from "./types";

export type OpportunityPage = {
  opportunities: StudentOpportunity[];
  filters: OpportunityFilters;
  filterOptions: OpportunityFilterOptions;
  coverage: { total: number; byCategory: Record<OpportunityCategory | "vestibular", number> };
  total: number;
  page: number;
  pageCount: number;
  today: string;
};
export const CATALOGUE_PAGE_SIZE = 24;

/** Do not serialize the whole live catalogue into public/member client props. */
export function buildOpportunityPage(items: readonly StudentOpportunity[], params: URLSearchParams, now = new Date()): OpportunityPage {
  const today = dateInBrazil(now);
  const filterOptions = getOpportunityFilterOptions(items, today, now.getTime());
  const filters = sanitizeOpportunityFilters(opportunityFiltersFromSearchParams(params), filterOptions);
  const visible = filterOpportunities(items, filters, today, true, false, now.getTime());
  const entries = groupAdmissionProcesses(rankOpportunities(visible, filters, now.getTime())).entries;
  const pageCount = Math.max(1, Math.ceil(entries.length / CATALOGUE_PAGE_SIZE));
  const requestedPage = Number(params.get("pagina"));
  const page = Math.min(pageCount, Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
  const count = (category: OpportunityFilters["category"]) => groupAdmissionProcesses(filterOpportunities(items, { ...filters, category }, today, true, false, now.getTime())).total;
  const byCategory = Object.fromEntries([
    ...OPPORTUNITY_CATEGORIES.map(({ id }) => [id, count(id)]), ["vestibular", count("vestibular")],
  ]) as OpportunityPage["coverage"]["byCategory"];
  const opportunities = entries.slice((page - 1) * CATALOGUE_PAGE_SIZE, page * CATALOGUE_PAGE_SIZE)
    .flatMap(entry => entry.type === "admission" ? entry.group.courses : [entry.opportunity]);
  return { opportunities, filters, filterOptions, coverage: { total: count(EMPTY_OPPORTUNITY_FILTERS.category), byCategory }, total: entries.length, page, pageCount, today };
}
