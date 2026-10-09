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

const stateCodes = new Set<string>(BRAZILIAN_STATE_CODES);
const emptyLocation: CanonicalBrazilianLocation = { stateCode: null, cityName: null };

export function normalizeBrazilianLocation(input: {
  stateCode?: unknown;
  cityName?: unknown;
}) {
  const rawState = typeof input.stateCode === "string" ? input.stateCode.trim().toUpperCase() : "";
  const rawCity = typeof input.cityName === "string" ? input.cityName.trim().replace(/\s+/g, " ") : "";

  if (!rawState && !rawCity) return { status: "missing" as const, location: emptyLocation };
  if (!stateCodes.has(rawState)) return { status: "invalid" as const, location: emptyLocation };
  if (rawCity && (rawCity.length > 100 || /[\u0000-\u001f\u007f]/.test(rawCity))) {
    return { status: "invalid" as const, location: emptyLocation };
  }

  return {
    status: "valid" as const,
    location: { stateCode: rawState as BrazilianStateCode, cityName: rawCity || null },
  };
}
