import "server-only";
import type { OpportunityFilters, StudentOpportunity } from "./types";
import { rankOpportunities } from "./ranking";

/** Shared public/member ranking; explicit queries keep their requested subject. */
export function orderOpportunityFeed(opportunities: readonly StudentOpportunity[], filters: OpportunityFilters) {
  return rankOpportunities(opportunities, filters);
}
