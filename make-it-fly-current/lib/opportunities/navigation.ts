import { opportunityFiltersFromSearchParams, setOpportunityFilterSearchParams } from "./types";

/** Keep only Radar state when moving between the public and member catalogues. */
export function memberRadarPath(searchParams: URLSearchParams) {
  const params = setOpportunityFilterSearchParams(
    new URLSearchParams(),
    opportunityFiltersFromSearchParams(searchParams),
  );
  const page = Number(searchParams.get("pagina"));
  if (Number.isSafeInteger(page) && page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/membros/oportunidades${query ? `?${query}` : ""}`;
}

export function memberRadarLoginHref(searchParams: URLSearchParams) {
  return `/membros/entrar?next=${encodeURIComponent(memberRadarPath(searchParams))}`;
}
