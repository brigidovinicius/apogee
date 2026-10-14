import { expect, it } from "vitest";
import { categoriesFromEvidence, OPPORTUNITY_CATEGORIES, validCategories } from "@/lib/ingestion/categories";

it("keeps the seven navigation identifiers stable and supports evidence-backed overlap", () => {
  expect(OPPORTUNITY_CATEGORIES).toHaveLength(7);
  expect(categoriesFromEvidence("research_scholarship", true)).toEqual(["formacao", "bolsas", "pesquisa"]);
  expect(categoriesFromEvidence("mobility_aid", false)).toEqual(["intercambios"]);
});

it("does not invent a competition, event or research category from an ambiguous benefit", () => {
  expect(categoriesFromEvidence("prize", false)).toEqual([]);
  expect(categoriesFromEvidence("project_funding", false)).toEqual([]);
  expect(categoriesFromEvidence("other", false)).toEqual([]);
  expect(validCategories(["competicoes", "eventos"])).toBe(true);
  expect(validCategories(["competicoes", "competicoes"])).toBe(false);
  expect(validCategories([])).toBe(false);
});
