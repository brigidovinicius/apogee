import "server-only";
import type { OpportunityFilters, StudentOpportunity } from "./types";

/** Explicit editorial groups, then confirmed cash, then the existing deadline criterion. */
export function orderOpportunityFeed(opportunities: readonly StudentOpportunity[], filters: OpportunityFilters) {
  // Geography and education narrow eligibility without requesting a different activity.
  const prioritizeActivities = !filters.category && !filters.kind && !filters.query?.trim();
  const group = (item: StudentOpportunity) => {
    if (item.admissionProcess || item.editorialNature === "formal_admission") return 3;
    if (item.editorialNature !== "extracurricular") return 2;
    return item.editorialFocus ? 0 : 1;
  };
  return [...opportunities].sort((left, right) => {
    if (prioritizeActivities && group(left) !== group(right)) return group(left) - group(right);
    const cash = Number(Boolean(right.financials?.benefits.length)) - Number(Boolean(left.financials?.benefits.length));
    if (cash) return cash;
    const deadline = (left.deadline ?? "9999-12-31").localeCompare(right.deadline ?? "9999-12-31");
    return deadline || left.id.localeCompare(right.id);
  });
}
