export const BRAZILIAN_STATE_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

export type CanonicalBrazilianLocation = {
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
};

export type LocationNormalization = {
  status: "valid" | "missing" | "invalid";
  location: CanonicalBrazilianLocation;
};

const stateCodes = new Set<string>(BRAZILIAN_STATE_CODES);
const emptyLocation: CanonicalBrazilianLocation = { stateCode: null, cityName: null };

export function isBrazilianStateCode(value: unknown): value is BrazilianStateCode {
  return typeof value === "string" && stateCodes.has(value);
}

/**
 * Canonical boundary for structured Brazilian locations. This deliberately
 * does not extract places from prose or guess a city from an institution.
 */
export function normalizeBrazilianLocation(input: {
  stateCode?: unknown;
  cityName?: unknown;
}): LocationNormalization {
  const rawState = typeof input.stateCode === "string" ? input.stateCode.trim().toUpperCase() : "";
  const rawCity = typeof input.cityName === "string" ? input.cityName.trim().replace(/\s+/g, " ") : "";

  if (!rawState && !rawCity) return { status: "missing", location: emptyLocation };
  if (!isBrazilianStateCode(rawState)) return { status: "invalid", location: emptyLocation };
  if (rawCity && (rawCity.length > 100 || /[\u0000-\u001f\u007f]/.test(rawCity))) {
    return { status: "invalid", location: emptyLocation };
  }

  return {
    status: "valid",
    location: { stateCode: rawState, cityName: rawCity || null },
  };
}
