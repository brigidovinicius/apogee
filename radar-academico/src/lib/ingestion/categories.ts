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

/** Title intent + participation context + audited source topics, rather than incidental keywords. */
export function categoriesFromContext(input: { title: string; text: string; sourceCategories: string[];
  benefitType: BenefitType; isCourse: boolean }): OpportunityCategory[] {
  const categories = categoriesFromEvidence(input.benefitType, input.isCourse);
  const title = input.title.trim();
  const participation = /inscriç(?:ão|ões)|particip(?:ar|antes|ação)|equipes|candidatur|submiss(?:ão|ões)/iu.test(input.text);
  const learningAbout = /^(?:curso|capacitação|formação|tutorial|guia)\b|\b(?:sobre|como organizar)\s+(?:hackathons?|competiç|eventos?)/iu.test(title);
  if (!participation || learningAbout || input.isCourse) return categories;
  const competition = /^(?:(?:\d+[ªº]?|[IVX]+)\s+)?(?:hackathon|competição|olimpíada|maratona de programação|desafio de inovação)\b/iu.test(title);
  const event = /^(?:(?:\d+[ªº]?|[IVX]+)\s+)?(?:evento|workshop|conferência|congresso|seminário|encontro|feira|palestra|webinar)\b/iu.test(title);
  const project = /^(?:projeto|programa)\s+de\s+(?:extensão|iniciação científica|inovação|empreendedorismo|aceleração|incubação)\b/iu.test(title);
  const sourceSupports = (pattern: RegExp) => input.sourceCategories.some(category => pattern.test(category));
  if (competition && sourceSupports(/competi|hackathon|olimpíada|inovação|eventos/iu)) categories.unshift("competicoes");
  if ((event || competition) && sourceSupports(/eventos|comunidades|hackathon|competi/iu)) categories.push("eventos");
  if (project && sourceSupports(/pesquisa|inovação|extensão|empreendedorismo|incuba|acelera/iu)) categories.unshift("pesquisa");
  return [...new Set(categories)];
}
