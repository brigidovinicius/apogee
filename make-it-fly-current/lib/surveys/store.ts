import "server-only";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/admin/access";
import { getSql } from "@/lib/members/db";
import {
  collaborationNotice, radarNotice, researchNotice, surveyDefinition, surveyInactivityMinutes, surveyProgressEvent,
  surveyStages, surveySubmissionVersion, validateSurveySubmission,
  type Survey, type SurveyDefinition, type SurveyResponseFilter,
} from "./contract";

const adminPath = "/admin/pesquisas";
type SurveyRow = { id: string; revision: number; definition: SurveyDefinition };
type ResponseRow = {
  id: string; revision: number; created_at: string; expires_at: string; research_notice: string | null;
  answers: { label: string; value: string | number }[];
  collaboration: "exercise" | "event" | "project" | null; email: string | null;
  collaboration_notice: string | null; radar_choice: "allow" | "deny" | null; radar_notice: string | null;
  respondent_name: string | null; respondent_email: string | null;
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

const responsePageSize = 20;

export async function surveyResponses(id: string, requestedPage: number, filter: SurveyResponseFilter) {
  await requireAdmin(adminPath);
  return getSql().begin("isolation level repeatable read read only", async tx => {
    const [row] = await tx<SurveyRow[]>`select id, revision, definition from apogee_survey where id = ${id}`;
    if (!row) return null;
    const survey = toSurvey(row);
    const stages = surveyStages(survey);
    const stageIds = stages.map(stage => stage.id);
    const [totals] = await tx<{ todos: number; pesquisa: number; radar: number; identified: number }[]>`
      select count(*)::int as todos,
        count(*) filter (where research_notice is not null)::int as pesquisa,
        count(*) filter (where research_notice is null)::int as radar,
        count(*) filter (where respondent_id is not null)::int as identified
      from apogee_survey_response where survey_id = ${id} and expires_at > now()`;
    const pageCount = Math.max(1, Math.ceil(totals[filter] / responsePageSize));
    const page = Math.min(requestedPage, pageCount);
    const responses = await tx<ResponseRow[]>`
      select response.id, response.revision, response.created_at, response.expires_at, response.research_notice,
        response.answers, response.collaboration, response.collaboration_notice, response.email, response.radar_choice,
        response.radar_notice, member.name as respondent_name, member.email as respondent_email
      from apogee_survey_response response
      left join "user" member on member.id = response.respondent_id
      where response.survey_id = ${id} and response.expires_at > now()
        and (${filter} = 'todos' or ${filter} = 'pesquisa' and response.research_notice is not null
          or ${filter} = 'radar' and response.research_notice is null)
      order by response.created_at desc, response.id limit ${responsePageSize} offset ${(page - 1) * responsePageSize}`;
    const [summary] = await tx<{ started: number; submitted: number; inactive: number }[]>`
      select count(*)::int as started,
        count(*) filter (where status = 'submitted')::int as submitted,
        count(*) filter (where status = 'active' and touched_at <= now() - make_interval(mins => ${surveyInactivityMinutes}))::int as inactive
      from apogee_survey_progress
      where survey_id = ${id} and revision = ${survey.revision} and expires_at > now() and status <> 'withdrawn'`;
    const counts = await tx<{ stage: string; reached: number; inactive: number }[]>`
      select catalog.stage,
        count(*) filter (where catalog.stage = any(progress.stages))::int as reached,
        count(*) filter (where progress.last_stage = catalog.stage and progress.status = 'active'
          and progress.touched_at <= now() - make_interval(mins => ${surveyInactivityMinutes}))::int as inactive
      from unnest(${stageIds}::text[]) as catalog(stage)
      left join apogee_survey_progress progress on progress.survey_id = ${id} and progress.revision = ${survey.revision}
        and progress.expires_at > now() and progress.status <> 'withdrawn'
      group by catalog.stage`;
    const byStage = new Map(counts.map(item => [item.stage, item]));
    return { survey, responses, totals, page, pageCount, summary,
      stages: stages.map(stage => ({ ...stage, reached: byStage.get(stage.id)?.reached ?? 0, inactive: byStage.get(stage.id)?.inactive ?? 0 })) };
  });
}

export async function deleteExpiredSurveyResponses(id: string) {
  const actor = await requireAdmin(adminPath);
  return getSql().begin(async tx => {
    const [allowed] = await tx`select id from "user" where id = ${actor.id} and role = 'admin' and not blocked for share`;
    if (!allowed) return 0;
    const removed = await tx`delete from apogee_survey_response where survey_id = ${id} and expires_at <= now()`;
    const progress = await tx`delete from apogee_survey_progress where survey_id = ${id} and expires_at <= now()`;
    return removed.count + progress.count;
  });
}

export async function recordSurveyProgress(slug: string, input: unknown) {
  if (!surveysEnabled()) return 404;
  const parsed = surveyProgressEvent.safeParse(input);
  if (!parsed.success) return 400;
  const event = parsed.data;
  return getSql().begin(async tx => {
    const [row] = await tx<SurveyRow[]>`
      select id, revision, definition from apogee_survey where slug = ${slug} for share`;
    if (!row) return 404;
    const survey = toSurvey(row);
    if (survey.retentionDays === null) return 404;
    if (event.kind === "withdraw") {
      if (event.revision > survey.revision) return 409;
      await tx`
        insert into apogee_survey_progress
          (survey_id, id, revision, status, last_stage, stages, sequence, expires_at)
        values (${row.id}, ${event.id}, ${event.revision}, 'withdrawn', '', '{}'::text[], 0, now() + make_interval(days => ${survey.retentionDays}))
        on conflict (survey_id, id) do update set status = 'withdrawn', last_stage = '', stages = '{}'::text[],
          research_notice = null, sequence = 0
        where apogee_survey_progress.status = 'active' and apogee_survey_progress.revision = excluded.revision`;
      return 200;
    }
    if (survey.status !== "open") return 404;
    if (event.revision !== row.revision) return 409;
    if (!surveyStages(survey).some(item => item.id === event.stage)) return 400;
    await tx`delete from apogee_survey_progress where survey_id = ${row.id} and expires_at <= now()`;
    await tx`
      insert into apogee_survey_progress
        (survey_id, id, revision, status, last_stage, stages, sequence, research_notice, expires_at)
      values (${row.id}, ${event.id}, ${row.revision}, 'active', ${event.stage}, ${[event.stage]}::text[],
        ${event.sequence}, ${researchNotice(survey)}, now() + make_interval(days => ${survey.retentionDays}))
      on conflict (survey_id, id) do update set
        stages = array(select distinct unnest(apogee_survey_progress.stages || excluded.stages)),
        last_stage = case when apogee_survey_progress.status = 'active' and excluded.sequence > apogee_survey_progress.sequence
          then excluded.last_stage else apogee_survey_progress.last_stage end,
        sequence = greatest(apogee_survey_progress.sequence, excluded.sequence), touched_at = now()
      where apogee_survey_progress.status <> 'withdrawn' and apogee_survey_progress.revision = excluded.revision`;
    return 200;
  });
}

export async function recordSurveyResponse(slug: string, input: unknown, memberId: string) {
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
    const respondentId = response.identityNoticeVersion ? memberId : null;
    await tx`delete from apogee_survey_response where survey_id = ${row.id} and expires_at <= now()`;
    const [created] = await tx`insert into apogee_survey_response
      (survey_id, id, revision, research_notice, answers, collaboration, collaboration_notice, email, radar_choice, radar_notice, expires_at, respondent_id)
      values (${row.id}, ${response.id}, ${row.revision}, ${response.research ? researchNotice(survey, Boolean(respondentId)) : null}, ${JSON.stringify(answers)}::jsonb,
        ${response.collaboration}, ${response.collaboration ? collaborationNotice : null}, ${response.email}, ${response.radar},
        ${response.radar ? radarNotice : null}, now() + make_interval(days => ${survey.retentionDays}), ${respondentId})
      on conflict (survey_id, id) do nothing returning id`;
    if (created && response.attempt) {
      await tx`
        insert into apogee_survey_progress
          (survey_id, id, revision, status, last_stage, stages, sequence, research_notice, expires_at)
        values (${row.id}, ${response.attempt}, ${row.revision}, 'submitted', 'envio', array['inicio', 'envio'], 0,
          ${researchNotice(survey)}, now() + make_interval(days => ${survey.retentionDays}))
        on conflict (survey_id, id) do update set
          status = 'submitted', last_stage = 'envio',
          stages = array(select distinct unnest(apogee_survey_progress.stages || excluded.stages)), touched_at = now()
        where apogee_survey_progress.status = 'active' and apogee_survey_progress.revision = excluded.revision`;
    }
    return 200;
  });
}
