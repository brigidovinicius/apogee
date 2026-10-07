import type { ApplicationRoute } from "./types";

export function classifyApplicationRoute(text: string): ApplicationRoute {
  const value = text.toLowerCase();
  if (/chamada institucional|submissão institucional|instituições proponentes/.test(value)) return "institutional_call";
  if (/por meio d[eo] professor|orientador responsável|contate o orientador/.test(value)) return "application_via_professor";
  if (/coordenador do projeto|coordenação do projeto/.test(value)) return "application_via_project_coordinator";
  if (/por meio da universidade|pró-reitoria|instituição de ensino/.test(value)) return "application_via_university";
  if (/departamento|secretaria acadêmica/.test(value)) return "application_via_department";
  if (/inscreva-se|formulário de inscrição|candidatura online/.test(value)) return "direct_student_application";
  return "unclear";
}