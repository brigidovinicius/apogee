import { BENEFIT_AUDIENCE_VALUES, BENEFIT_PATHS, type BenefitView } from "./types";

export type BenefitSearchParams = Record<string, string | string[] | undefined>;

export function benefitNavigation(params: BenefitSearchParams, view: BenefitView) {
  const query = typeof params.q === "string" ? params.q.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100) : "";
  const category = typeof params.categoria === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(params.categoria) && params.categoria.length <= 80 ? params.categoria : "";
  const audience = BENEFIT_AUDIENCE_VALUES.find(value => value === params.publico) ?? "";
  const filters = new URLSearchParams();
  if (view !== "history" && query) filters.set("q", query);
  if (view !== "history" && category) filters.set("categoria", category);
  if (view !== "history" && audience) filters.set("publico", audience);
  const listHref = BENEFIT_PATHS[view] + (filters.size ? "?" + filters : "");
  if (view === "saved") filters.set("origem", "salvos");
  if (view === "history") filters.set("origem", "resgates");
  const detailSearch = filters.size ? "?" + filters : "";
  return { query, category, audience, listHref, detailSearch };
}
