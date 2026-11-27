import { BRAZILIAN_STATE_CODES, normalizeBrazilianLocation, type BrazilianStateCode } from "./location";
import { AREAS, OPPORTUNITY_CATEGORIES } from "./vocabulary";

export const RADAR_FOR_YOU = "/membros/oportunidades/para-voce";
export const RADAR_PREFERENCES = "/membros/perfil/radar";

export const RADAR_PROFILES = {
  ai: "Entusiasta de IA",
  tech: "Entusiasta de tecnologia",
  student: "Estudante",
  entrepreneur: "Empreendedor(a)",
  builder: "Builder",
  founder: "Founder",
} as const;

export const RADAR_STAGES = {
  highSchool: "Ensino médio",
  undergraduate: "Graduação",
  graduate: "Graduação concluída",
  postgraduate: "Pós-graduação",
} as const;

export const RADAR_FORMATS = {
  any: "Qualquer modalidade",
  online: "Somente online",
  local: "Online e presencial na minha região",
} as const;

export const RADAR_EMAIL_OPTIONS = {
  off: "Sem avisos por e-mail",
  weekly: "Resumo semanal",
  urgent: "Resumo semanal e prazos próximos",
} as const;

type Area = keyof typeof AREAS;
type Category = (typeof OPPORTUNITY_CATEGORIES)[number]["id"];
export type RadarEmail = keyof typeof RADAR_EMAIL_OPTIONS;
export type RadarPreferences = {
  profiles: (keyof typeof RADAR_PROFILES)[];
  course: string;
  stage: keyof typeof RADAR_STAGES | "";
  interests: Area[];
  categories: Category[];
  format: keyof typeof RADAR_FORMATS;
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
};

export const EMPTY_RADAR_PREFERENCES: RadarPreferences = {
  profiles: [], course: "", stage: "", interests: [], categories: [],
  format: "any", stateCode: null, cityName: null,
};

function selectValues<T extends string>(values: readonly unknown[], allowed: readonly T[]): T[] {
  return allowed.filter(value => values.includes(value));
}

export function parseRadarPreferences(data: FormData): { settings: RadarPreferences; email: RadarEmail } | { error: string } {
  const field = (name: string) => {
    const value = data.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const course = field("course");
  const city = field("city");
  if (course.length > 100 || city.length > 80 || /[\p{Cc}]/u.test(course + city)) {
    return { error: "Confira o curso e a cidade e tente novamente." };
  }
  const state = selectValues([field("state")], BRAZILIAN_STATE_CODES)[0] ?? null;
  const format = selectValues([field("format")], Object.keys(RADAR_FORMATS) as RadarPreferences["format"][])[0] ?? "any";
  if (!state && (format === "local" || city)) return { error: "Selecione um estado para usar a localização." };
  const { location } = normalizeBrazilianLocation({ stateCode: state, cityName: city });
  if (city && !location.cityName) return { error: "Confira o nome da cidade." };
  const profiles = selectValues(data.getAll("profiles"), Object.keys(RADAR_PROFILES) as RadarPreferences["profiles"]);
  const interests = selectValues(data.getAll("interests"), Object.keys(AREAS) as Area[]);
  const categories = selectValues(data.getAll("categories"), OPPORTUNITY_CATEGORIES.map(category => category.id));
  const stage = selectValues([field("stage")], Object.keys(RADAR_STAGES) as RadarPreferences["stage"][])[0] ?? "";
  if (!profiles.length && !interests.length && !categories.length && !course && !stage) {
    return { error: "Escolha pelo menos um perfil, interesse ou tipo de oportunidade, ou informe sua formação." };
  }
  const email = selectValues([field("email")], Object.keys(RADAR_EMAIL_OPTIONS) as RadarEmail[])[0] ?? "off";
  return { settings: { profiles, course, stage, interests, categories, format, ...location }, email };
}
