import { opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams } from "./types";

/** Keep only Radar filters and pagination when moving between pages. */
export function radarCatalogueQuery(searchParams: URLSearchParams) {
  const params = setOpportunityFilterSearchParams(
    new URLSearchParams(),
    opportunityFiltersFromSearchParams(searchParams),
  );
  const page = Number(searchParams.get("pagina"));
  if (Number.isSafeInteger(page) && page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function memberRadarPath(searchParams: URLSearchParams) {
  return `/membros/oportunidades${radarCatalogueQuery(searchParams)}`;
}

export function memberRadarLoginHref(searchParams: URLSearchParams) {
  return `/membros/entrar?next=${encodeURIComponent(memberRadarPath(searchParams))}`;
}
