import type { StudentOpportunity } from "./opportunities/types";

export type HomeOpportunityCategory = "all" | "competicoes" | "eventos";

// Presentation only: keep the catalogue's relative order within each group.
// The Radar's ranking, classification and access rules are unchanged.
export function homeOpportunityIsCurrent(item: StudentOpportunity, now: Date) {
  if (item.opportunityStatus === "upcoming") return false;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  if (item.deadline && item.deadline < today) return false;
  if (item.deadlineAt) {
    const end = Date.parse(item.deadlineAt);
    if (!Number.isFinite(end) || end <= now.getTime()) return false;
  }
  if (item.deadlineUnknown) {
    if (!item.eventStartsAt) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.eventStartsAt)) return item.eventStartsAt >= today;
    const start = Date.parse(item.eventStartsAt);
    if (!Number.isFinite(start) || start <= now.getTime()) return false;
  }
  return true;
}

export function selectHomeOpportunities(
  items: readonly StudentOpportunity[],
  now: Date,
  category: HomeOpportunityCategory = "all",
  limit = 6,
) {
  const current = items.filter((item) => homeOpportunityIsCurrent(item, now));
  if (category !== "all") return current.filter((item) => item.categories?.includes(category)).slice(0, limit);
  const featured = (item: StudentOpportunity) =>
    item.categories?.some((value) => value === "competicoes" || value === "eventos") ||
    item.kind === "Prêmio" || item.kind === "Estágio" || item.kind === "Fomento";
  return [...current.filter(featured), ...current.filter((item) => !featured(item))].slice(0, limit);
}

export function homeOpportunitySnapshot(items: readonly StudentOpportunity[], now: Date) {
  return [...new Map([
    ...selectHomeOpportunities(items, now),
    ...selectHomeOpportunities(items, now, "competicoes"),
    ...selectHomeOpportunities(items, now, "eventos"),
  ].map((item) => [item.id, item])).values()];
}
