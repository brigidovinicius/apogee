import "server-only";
import { countActiveOpportunityFilters, type OpportunityFilters, type StudentOpportunity } from "./types";

/** Explicit editorial groups, then confirmed cash, then the existing deadline criterion. */
export function orderMemberFeed(opportunities: readonly StudentOpportunity[], filters: OpportunityFilters) {
  const defaultFeed = countActiveOpportunityFilters(filters) === 0;
  const group = (item: StudentOpportunity) => {
    if (item.admissionProcess || item.editorialNature === "formal_admission") return 2;
    return item.editorialNature === "extracurricular" ? 0 : 1;
  };
  return [...opportunities].sort((left, right) => {
    if (defaultFeed && group(left) !== group(right)) return group(left) - group(right);
    const cash = Number(Boolean(right.financials?.benefits.length)) - Number(Boolean(left.financials?.benefits.length));
    if (cash) return cash;
    const deadline = (left.deadline ?? "9999-12-31").localeCompare(right.deadline ?? "9999-12-31");
    return deadline || left.id.localeCompare(right.id);
  });
}
