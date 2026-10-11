export const BRAZILIAN_STATE_CODES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

// Capitais e centros regionais para procurar programas com elegibilidade nacional.
// Esta lista não atribui uma cidade a uma oportunidade sem localização confirmada.
export const SEARCH_CITIES_BY_STATE: Record<BrazilianStateCode, readonly string[]> = {
  AC: ["Rio Branco", "Cruzeiro do Sul"],
  AL: ["Maceió", "Arapiraca"],
  AP: ["Macapá", "Santana"],
  AM: ["Manaus", "Parintins"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte"],
  DF: ["Brasília"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis"],
  MA: ["São Luís", "Imperatriz"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis"],
  MS: ["Campo Grande", "Dourados"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora"],
  PA: ["Belém", "Ananindeua", "Santarém"],
  PB: ["João Pessoa", "Campina Grande"],
  PR: ["Curitiba", "Londrina", "Maringá"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru"],
  PI: ["Teresina", "Parnaíba"],
  RJ: ["Rio de Janeiro", "Niterói", "Duque de Caxias", "Nova Iguaçu"],
  RN: ["Natal", "Mossoró", "Parnamirim"],
  RS: ["Porto Alegre", "Caxias do Sul", "Pelotas"],
  RO: ["Porto Velho", "Ji-Paraná"],
  RR: ["Boa Vista", "Rorainópolis"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "São José"],
  SP: ["São Paulo", "Guarulhos", "Campinas", "São José dos Campos", "Santos", "Ribeirão Preto"],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Itabaiana"],
  TO: ["Palmas", "Araguaína", "Gurupi"],
};

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
