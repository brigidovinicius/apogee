import type { ApplicantType } from "./types";

export function classifyAudience(text: string): ApplicantType {
  const value = text.toLowerCase();
  if (/empresa|startup|pessoa jurídica/.test(value)) return "company";
  if (/instituiç(ão|ões)|universidades|programa de pós-graduação/.test(value)) return "institution";
  if (/professor|docente|orientador/.test(value) && !/estudante|discente|aluno/.test(value)) return "professor";
  if (/pesquisador/.test(value) && !/estudante|discente|aluno/.test(value)) return "researcher";
  if (/ensino médio|secundarista/.test(value)) return "high_school_student";
  if (/pós-graduação|mestrado|doutorado|pós-doutorado/.test(value)) return "postgraduate_student";
  if (/graduação|graduando|acadêmico|estudante/.test(value)) return "undergraduate_student";
  return "mixed";
}