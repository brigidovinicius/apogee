import type { ApplicantType } from "./types";

export function classifyAudience(text: string): ApplicantType {
  const value = text.toLowerCase();
  const matches = new Set<ApplicantType>();
  // A provider, sponsor or course topic is not evidence of who can apply.
  const targeted = (audience: string) => new RegExp(
    `(?:para|destinad[oa]s? a|voltad[oa]s? a|público[ -]alvo:)\\s+(?:as?\\s+)?(?:${audience})\\b|(?:${audience})\\s+(?:podem|poderão|interessad[oa]s)\\b`,
  ).test(value);
  if (targeted("empresas?|startups?|pessoas? jurídicas?")) matches.add("company");
  if (targeted("instituições|universidades|programas de pós-graduação")) matches.add("institution");
  if (targeted("professores|docentes|orientadores")) matches.add("professor");
  if (targeted("pesquisadores")) matches.add("researcher");
  if (/(?:estudantes?|discentes?|alunos?) (?:d[eo] |matriculados? n[oa] )ensino médio|secundaristas?/.test(value)) matches.add("high_school_student");
  if (/(?:estudantes?|discentes?|alunos?) (?:d[ea] |matriculados? n[oa] )(?:pós-graduação|mestrado|doutorado)|mestrand[oa]s?|doutorand[oa]s?|pós-doutorand[oa]s?/.test(value)) matches.add("postgraduate_student");
  if (/(?:estudantes?|discentes?|alunos?) (?:d[ea] |matriculados? n[oa] )graduação|graduand[oa]s?/.test(value)) matches.add("undergraduate_student");
  return matches.size === 1 ? [...matches][0] : "mixed";
}
