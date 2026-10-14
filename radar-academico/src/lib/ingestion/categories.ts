import type { BenefitType } from "./types";

export const OPPORTUNITY_CATEGORIES = [
  "formacao", "bolsas", "intercambios", "competicoes", "pesquisa", "carreira", "eventos",
] as const;
export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export function categoriesFromEvidence(benefitType: BenefitType, isCourse: boolean): OpportunityCategory[] {
  const categories: OpportunityCategory[] = [];
  if (isCourse) categories.push("formacao");
  if (["academic_scholarship", "research_scholarship", "extension_scholarship", "monitor_scholarship", "financial_aid", "housing_aid"].includes(benefitType)) categories.push("bolsas");
  if (benefitType === "mobility_aid") categories.push("intercambios");
  if (benefitType === "research_scholarship") categories.push("pesquisa");
  if (benefitType === "internship") categories.push("carreira");
  // A prize, project grant or generic benefit alone does not prove a competition, research activity or event.
  return categories;
}

export function validCategories(value: unknown): value is OpportunityCategory[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((item) => typeof item === "string" && OPPORTUNITY_CATEGORIES.includes(item as OpportunityCategory)) &&
    new Set(value).size === value.length;
}
