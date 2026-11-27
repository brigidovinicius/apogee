import "server-only";
import { RADAR_PROFILES, type RadarPreferences } from "./radar-preferences";
import { normalizeOpportunitySearch } from "./search";
import { dateInBrazil, isOpportunityOpen, type StudentOpportunity } from "./types";
import { AREAS, OPPORTUNITY_CATEGORIES } from "./vocabulary";

type Area = RadarPreferences["interests"][number];
type Profile = RadarPreferences["profiles"][number];

const courseAreas: readonly [RegExp, readonly Area[]][] = [
  [/\b(?:computacao|informatica|software|sistemas de informacao|programacao|cibernetica)\b/, ["tecnologia"]],
  [/\b(?:dados|estatistica)\b/, ["dados", "matematica"]],
  [/\b(?:inteligencia artificial|aprendizado de maquina)\b/, ["ia", "dados", "tecnologia"]],
  [/\b(?:robotica|mecatronica|engenharia eletrica|engenharia mecanica)\b/, ["robotica"]],
  [/\b(?:administracao|gestao|economia|contabilidade|empreendedorismo)\b/, ["negocios"]],
  [/\b(?:design|artes|arquitetura)\b/, ["artes"]],
  [/\b(?:jornalismo|publicidade|comunicacao)\b/, ["comunicacao"]],
  [/\b(?:medicina|enfermagem|psicologia|nutricao|odontologia|fisioterapia)\b/, ["saude"]],
  [/\b(?:direito|ciencias juridicas)\b/, ["direito"]],
  [/\b(?:pedagogia|educacao|licenciatura)\b/, ["educacao"]],
];

const academicAreas = ["matematica", "fisica", "quimica", "biologia", "astronomia", "geografia"] as const;
const academicStage = {
  "Ensino médio": "highSchool", "Graduação": "undergraduate", "Pós-graduação": "postgraduate",
} as const;
const gradRequired = /\b(?:mestrado|doutorado|pos\s*doutorado|postdoc|phd|graduacao completa|graduacao concluida|diploma de graduacao|bachelor s degree required)\b/;
const studentRequired = /\b(?:estudantes|alunos|graduandos|universitarios|students)\b/;
const exclusivelyStudents = /\b(?:apenas|somente|exclusivamente) (?:para )?(?:estudantes|alunos|graduandos)\b/;
const collegeAudience = /\b(?:para (?:estudantes|alunos)(?: de graduacao| universitarios)?|estudantes universitarios|college students)\b/;
const broadAudience = /\b(?:publico geral|abert[oa] a todos|qualquer pessoa|open to everyone|open to the public)\b/;

function areasForCourse(course: string) {
  const value = normalizeOpportunitySearch(course);
  return new Set<Area>([
    ...courseAreas.flatMap(([pattern, areas]) => pattern.test(value) ? areas : []),
    ...academicAreas.filter(area => value.split(" ").includes(area)),
  ]);
}

function profilesForOpportunity(item: StudentOpportunity, areas: readonly Area[], title: string, requirements: string) {
  const subtype = item.discovery?.subtype;
  const hackathon = subtype === "hackathon";
  const tech = areas.some(area => ["tecnologia", "ia", "dados", "robotica"].includes(area));
  const venture = /\b(?:empreendedorismo|empreendedores|negocios|incubacao|aceleracao|fundadores|para startups?)\b/.test(title);
  const startupProgram = /\b(?:startups?|incubacao|aceleracao|venture|fundadores)\b/.test(title) &&
    (item.discovery?.primaryType === "competicoes" || item.categories?.includes("competicoes") ||
      /\b(?:incubacao|aceleracao|venture|para (?:startups?|fundadores))\b/.test(title));
  const prototype = /\b(?:prototipagem|prototipos?|maker|codex|criacao de produtos)\b/.test(title);
  const result = new Set<Profile>();
  if (areas.includes("ia")) result.add("ai");
  if (tech) result.add("tech");
  if (item.level !== "Público diverso" || subtype === "estagio" || studentRequired.test(requirements)) result.add("student");
  if (areas.includes("negocios") || venture) result.add("entrepreneur");
  if (hackathon || prototype || tech && (item.editorialFocus === "extracurricular_project" || /\bbootcamp\b/.test(title))) result.add("builder");
  if (startupProgram || item.kind === "Fomento" && (venture || areas.includes("negocios"))) result.add("founder");
  return result;
}

export type ProfileMatch = {
  opportunity: StudentOpportunity;
  reason: string;
  checkRequirements: boolean;
  canNotify: boolean;
  score: number;
  deadlineTime: number;
};

export function matchRadarProfile(
  items: readonly StudentOpportunity[],
  preferences: RadarPreferences,
  dismissed: ReadonlySet<string> = new Set(),
  now = new Date(),
): ProfileMatch[] {
  const nowMs = now.getTime();
  const today = dateInBrazil(now);
  const studyAreas = areasForCourse(preferences.course);
  const hasPersonalSignal = preferences.interests.length > 0 || studyAreas.size > 0 ||
    preferences.profiles.length > 0 || Boolean(preferences.stage);
  const matches: ProfileMatch[] = [];
  for (const item of items) {
    if (dismissed.has(item.id) || item.entranceExam || item.admissionProcess || !isOpportunityOpen(item, today, nowMs)) continue;
    const title = normalizeOpportunitySearch(item.title);
    const requirements = normalizeOpportunitySearch(item.eligibility);
    const areas = item.discovery?.areas ?? [];
    const category = OPPORTUNITY_CATEGORIES.find(({ id }) => preferences.categories.includes(id) &&
      (item.discovery?.primaryType === id || item.categories?.includes(id)));
    if (preferences.categories.length && !category) continue;

    const remote = item.employment?.workplace === "remote";
    const online = item.participationFormat === "online" || remote;
    const sameState = Boolean(preferences.stateCode && item.stateCode === preferences.stateCode);
    const local = sameState && (!preferences.cityName ||
      normalizeOpportunitySearch(item.cityName ?? "") === normalizeOpportunitySearch(preferences.cityName));
    if (preferences.format === "online" && !online || preferences.format === "local" && !online && !local) continue;

    const needsDegree = gradRequired.test(title + " " + requirements);
    const acceptedStage = item.level === "Público diverso" ? undefined : academicStage[item.level];
    const knownStage = Boolean(preferences.stage);
    if (knownStage && acceptedStage && preferences.stage !== acceptedStage) continue;
    if (needsDegree && (preferences.stage === "highSchool" || preferences.stage === "undergraduate")) continue;
    if (exclusivelyStudents.test(requirements) && preferences.stage === "graduate") continue;

    const matchingInterest = preferences.interests.find(area => areas.includes(area));
    const matchingCourse = areas.some(area => studyAreas.has(area));
    const matchingProfiles = profilesForOpportunity(item, areas, title, requirements);
    const profile = preferences.profiles.find(value => value !== "student" && matchingProfiles.has(value)) ??
      preferences.profiles.find(value => matchingProfiles.has(value));
    const matchingStage = knownStage && preferences.stage === acceptedStage;
    if (!matchingInterest && !matchingCourse && !profile && !matchingStage && (hasPersonalSignal || !category)) continue;

    const reason = matchingInterest ? `Você acompanha ${AREAS[matchingInterest]}.`
      : matchingCourse ? "Tem relação com a área do seu curso."
        : profile ? `Combina com o perfil ${RADAR_PROFILES[profile]} que você escolheu.`
          : category ? `Você busca ${category.label.toLocaleLowerCase("pt-BR")}.`
            : "A oportunidade é da sua etapa de formação.";
    const audienceConfirmed = (matchingStage || broadAudience.test(requirements) ||
      preferences.stage === "undergraduate" && collegeAudience.test(requirements) &&
        !/\b(?:ensino medio|ensino fundamental|high school|middle school)\b/.test(requirements)) && !needsDegree;
    const formatConfirmed = online || Boolean(item.participationFormat && (local || preferences.format === "any"));
    const deadlineTime = item.deadlineAt ? Date.parse(item.deadlineAt)
      : item.deadline ? Date.parse(`${item.deadline}T23:59:59-03:00`) : Infinity;
    matches.push({
      opportunity: item,
      reason: reason + (remote ? " A vaga é remota." : online ? " A participação é online." : local ? " Fica na sua região." : ""),
      checkRequirements: !audienceConfirmed || !formatConfirmed,
      canNotify: Boolean((matchingInterest || matchingCourse || profile && profile !== "student") &&
        audienceConfirmed && formatConfirmed && item.opportunityStatus === "open" && Number.isFinite(deadlineTime)),
      score: (matchingInterest ? 8 : 0) + (matchingCourse ? 4 : 0) + (profile && profile !== "student" ? 3 : 0) +
        (category ? 2 : 0) + (matchingStage ? 2 : 0) + (local || online ? 1 : 0),
      deadlineTime,
    });
  }
  return matches.sort((a, b) => b.score - a.score || a.deadlineTime - b.deadlineTime || a.opportunity.id.localeCompare(b.opportunity.id));
}
