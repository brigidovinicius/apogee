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

const stateNames = ["Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal", "Espírito Santo", "Goiás",
  "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais", "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí",
  "Rio de Janeiro", "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina", "São Paulo", "Sergipe", "Tocantins"];
const plain = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").trim().toUpperCase();
/** Normalize only an explicitly supplied Brazilian UF/name, never an inferred location. */
export function brazilianStateCode(value: unknown): BrazilianStateCode | null {
  if (typeof value !== "string") return null;
  const code = plain(value);
  if (stateCodes.has(code)) return code as BrazilianStateCode;
  const index = stateNames.findIndex(name => plain(name) === code);
  return index < 0 ? null : BRAZILIAN_STATE_CODES[index];
}

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
