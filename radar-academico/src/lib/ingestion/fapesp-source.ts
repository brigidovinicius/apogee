export const FAPESP_SOURCE_ID = "fapesp-open-fellowships";
export const FAPESP_LISTING_URL = "https://oportunidades.fapesp.br/";

/** The numeric ID survives the official portal's host/path migration. */
export function fapespPostingId(url: string): string | null {
  return /^https:\/\/(?:(?:www\.)?fapesp\.br\/oportunidades|oportunidades\.fapesp\.br)\/[^/?#]+\/(\d+)\/$/.exec(url)?.[1] ?? null;
}

/** A root prefix on the new host must not widen the legacy host's scope. */
export function isFapespResourceUrl(url: string): boolean {
  return url === FAPESP_LISTING_URL || /^https:\/\/(?:www\.)?fapesp\.br\/oportunidades\/$/.test(url) || fapespPostingId(url) !== null;
}
