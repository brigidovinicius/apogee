import "server-only";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/access";
import { getSql } from "@/lib/members/db";
import {
  collaborationNotice, radarNotice, researchNotice, surveyDefinition, surveySubmissionVersion, validateSurveySubmission,
  type Survey, type SurveyDefinition,
} from "./contract";

const adminPath = "/admin/pesquisas";
type SurveyRow = { id: string; revision: number; definition: SurveyDefinition };
type ResponseRow = {
  id: string; revision: number; created_at: string; research_notice: string | null;
  answers: { label: string; value: string | number }[];
  collaboration: "exercise" | "event" | "project" | null; email: string | null;
  radar_choice: "allow" | "deny" | null;
};
const toSurvey = (row: SurveyRow): Survey => ({ ...surveyDefinition.parse(row.definition), id: row.id, revision: row.revision });

export function surveysEnabled() {
  return process.env.APOGEE_LOCAL_PREVIEW === "1" || process.env.APOGEE_SURVEYS_ENABLED === "true";
}

export async function listSurveys() {
  await requireAdmin(adminPath);
  return (await getSql()<SurveyRow[]>`select id, revision, definition from apogee_survey order by updated_at desc, id`).map(toSurvey);
}

export async function getAdminSurvey(id: string) {
  await requireAdmin(adminPath);
  const [row] = await getSql()<SurveyRow[]>`select id, revision, definition from apogee_survey where id = ${id}`;
  return row ? toSurvey(row) : null;
}

export async function getPublicSurvey(slug: string) {
  if (!surveysEnabled()) return null;
  const [row] = await getSql()<SurveyRow[]>`
    select id, revision, definition from apogee_survey where slug = ${slug} and definition->>'status' = 'open'`;
  return row ? toSurvey(row) : null;
}

export async function saveSurvey(input: SurveyDefinition, previous?: { id: string; revision: number }) {
  const actor = await requireAdmin(adminPath);
  return getSql().begin(async tx => {
    const [allowed] = await tx`select id from "user" where id = ${actor.id} and role = 'admin' and not blocked for share`;
    if (!allowed) return { error: "A edição está indisponível para esta conta." } as const;
    if (!previous) {
      const id = randomUUID();
      await tx`insert into apogee_survey (id, slug, definition) values (${id}, ${input.slug}, ${JSON.stringify(input)}::jsonb)`;
      return { id, revision: 1 } as const;
    }
    const [row] = await tx<{ id: string; revision: number }[]>`
      update apogee_survey set slug = ${input.slug}, definition = ${JSON.stringify(input)}::jsonb, revision = revision + 1, updated_at = now()
      where id = ${previous.id} and revision = ${previous.revision} returning id, revision`;
    return row ?? { error: "A pesquisa mudou em outra edição. Recarregue antes de salvar." };
  });
}

export async function surveyResponses(id: string, page: number) {
  await requireAdmin(adminPath);
  const [row] = await getSql()<SurveyRow[]>`select id, revision, definition from apogee_survey where id = ${id}`;
  if (!row) return null;
  const responses = await getSql()<ResponseRow[]>`
    select id, revision, created_at, research_notice, answers, collaboration, email, radar_choice
    from apogee_survey_response where survey_id = ${id} and expires_at > now()
    order by created_at desc, id limit 21 offset ${(page - 1) * 20}`;
  return { survey: toSurvey(row), responses: responses.slice(0, 20), hasMore: responses.length > 20 };
}

export async function deleteExpiredSurveyResponses(id: string) {
  const actor = await requireAdmin(adminPath);
  return getSql().begin(async tx => {
    const [allowed] = await tx`select id from "user" where id = ${actor.id} and role = 'admin' and not blocked for share`;
    if (!allowed) return 0;
    const removed = await tx`delete from apogee_survey_response where survey_id = ${id} and expires_at <= now()`;
    return removed.count;
  });
}

export async function recordSurveyResponse(slug: string, input: unknown) {
  if (!surveysEnabled()) return 404;
  return getSql().begin(async tx => {
    const [row] = await tx<SurveyRow[]>`
      select id, revision, definition from apogee_survey where slug = ${slug} and definition->>'status' = 'open' for share`;
    if (!row) return 404;
    const version = surveySubmissionVersion.safeParse(input);
    if (!version.success) return 400;
    if (version.data.revision !== row.revision) {
      const [receipt] = await tx`select 1 from apogee_survey_response where survey_id = ${row.id} and id = ${version.data.id}
        and revision = ${version.data.revision} and expires_at > now()`;
      return receipt ? 200 : 409;
    }
    const survey = toSurvey(row);
    const response = validateSurveySubmission(survey, input);
    if (!response || survey.retentionDays === null) return 400;
    const answers = response.research ? survey.questions.flatMap(q => Object.hasOwn(response.answers, q.id)
      ? [{ label: q.label, value: response.answers[q.id] }]
      : []) : [];
    await tx`delete from apogee_survey_response where survey_id = ${row.id} and expires_at <= now()`;
    await tx`insert into apogee_survey_response
      (survey_id, id, revision, research_notice, answers, collaboration, collaboration_notice, email, radar_choice, radar_notice, expires_at)
      values (${row.id}, ${response.id}, ${row.revision}, ${response.research ? researchNotice(survey) : null}, ${JSON.stringify(answers)}::jsonb,
        ${response.collaboration}, ${response.collaboration ? collaborationNotice : null}, ${response.email}, ${response.radar},
        ${response.radar ? radarNotice : null}, now() + make_interval(days => ${survey.retentionDays}))
      on conflict (survey_id, id) do nothing`;
    return 200;
  });
}
