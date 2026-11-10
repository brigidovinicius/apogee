import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import type { PipelineSource } from "./pipeline-validation";

export type PipelineSnapshot = { provider: string; account_email: string | null; daily_calls_cap: number; weekly_calls_cap: number; daily_tokens_cap: number; weekly_tokens_cap: number; generation_enabled: boolean; images_enabled: boolean; operator_commands_only: boolean; model: string; image_model: string | null; organization_id: string | null; project_id: string | null; article_cap: number; daily_cap: number; cycle_cap: number; cycle_fraction: number; per_day: number; per_week: number };
export type Evidence = { id: string; title: string; text: string; url: string; rights_reference: string };
export type PipelineCandidate = { id: string; title: string; url: string; editoria: string; source_id: string; status: string; reason: string | null; post_id: number | null; published_at: Date; evidence: Evidence[]; image_state: string | null; image_reason: string | null; prompt: string | null; alt: string | null; caption: string | null; media_id: string | null; post_revision: number | null; post_title: string | null; post_status: string | null; body: string | null; seo_title: string | null; seo_description: string | null; seo_noindex: boolean | null };
export type PipelineCommand = { id: string; kind: string; state: string; created_at: Date; result: { generation?: { reason?: string }; image?: { reason?: string } } | null };
export type PipelineAttempt = { id: string; candidate_id: string; kind: string; state: string; provider: string; quota_reserved: string; quota_used: string | null; model: string; charged: string | null; reserved: string; reason: string | null; created_at: Date };
export async function getPipelineDashboard(page = 1) {
  const sql = getSql();
  const [{ ready }] = await sql<{ ready: boolean }[]>`select to_regclass('blog_worker.subscription') is not null as ready`;
  if (!ready) return null;
  const [control] = await sql<{ paused: boolean; reason: string | null; snapshot: PipelineSnapshot | null; heartbeat_at: Date | null; alive: boolean }[]>`select paused,reason,snapshot,heartbeat_at,coalesce(heartbeat_at between now()-interval '4 minutes' and now(),false) as alive from blog_worker.control where singleton=true`;
  const sources = await sql<{ id: string; definition: PipelineSource; revision: number; last_collected_at: Date | null; last_result: string | null }[]>`select c.id,c.definition,c.revision,s.last_collected_at,s.last_result from blog_worker.source_catalog c left join blog_worker.source_state s using(id) order by c.id`;
  const candidates = await sql<PipelineCandidate[]>`select c.id,c.title,c.url,c.editoria,c.source_id,c.status,c.reason,c.post_id,c.published_at,c.evidence,
    j.state as image_state,j.reason as image_reason,j.prompt,j.alt,j.caption,j.media_id,b.revision as post_revision,b.title as post_title,b.status as post_status,b.body,b.seo_title,b.seo_description,b.seo_noindex
    from blog_worker.candidate c left join blog_worker.image_job j on j.candidate_id=c.id left join public.blog_post b on b.id=c.post_id
    order by c.created_at desc,c.id limit 20 offset ${(page - 1) * 20}`;
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from blog_worker.candidate`;
  const commands = await sql<PipelineCommand[]>`select id,kind,state,result,created_at from blog_worker.command order by created_at desc limit 10`;
  const attempts = await sql<PipelineAttempt[]>`select id,candidate_id,kind,state,provider,quota_reserved::text,quota_used::text,price->>'model' as model,charged_micro_usd::text as charged,reserved_micro_usd::text as reserved,reason,created_at from blog_worker.attempt order by created_at desc limit 20`;
  const counts = await sql<{ status: string; count: number }[]>`select status,count(*)::int as count from blog_worker.candidate group by status`;
  const [usage] = await sql<{ charged: string; held: string; day: string; cycle: string }[]>`select coalesce(sum(charged_micro_usd),0)::text as charged,
    coalesce(sum(reserved_micro_usd) filter(where state<>'confirmed'),0)::text as held,
    coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where day=(now() at time zone 'America/Sao_Paulo')::date),0)::text as day,
    coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where benefit_id in (select id from blog_worker.benefit where starts_at<=now() and expires_at>now() and revoked_at is null)),0)::text as cycle from blog_worker.attempt`;
  const [benefit] = await sql<{ amount: string; remaining: string; expires_at: Date; verified_at: Date; shared: boolean }[]>`select amount_micro_usd::text as amount,remaining_micro_usd::text as remaining,expires_at,verified_at,
    coalesce(attestation->>'billing_scope'='authorized_shared_organization',false) as shared from blog_worker.benefit where revoked_at is null order by expires_at desc limit 1`;
  const [subscription] = await sql<{ account_email: string; plan: string; verified_at: Date; valid_until: Date; valid: boolean }[]>`select account_email,plan,verified_at,valid_until,valid_until>now() as valid from blog_worker.subscription where singleton=true`;
  const [quota] = await sql<{ day_calls: number; week_calls: number; day_tokens: string; week_tokens: string; held: string }[]>`select
    count(*) filter(where day=(now() at time zone 'America/Sao_Paulo')::date)::int as day_calls,
    count(*) filter(where week=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date)::int as week_calls,
    coalesce(sum(coalesce(quota_used,quota_reserved)) filter(where day=(now() at time zone 'America/Sao_Paulo')::date),0)::text as day_tokens,
    coalesce(sum(coalesce(quota_used,quota_reserved)) filter(where week=date_trunc('week',now() at time zone 'America/Sao_Paulo')::date),0)::text as week_tokens,
    coalesce(sum(quota_reserved) filter(where state<>'confirmed'),0)::text as held from (
      select day,week,quota_used,quota_reserved,state from blog_worker.attempt where provider='google_subscription'
      union all select (created_at at time zone 'America/Sao_Paulo')::date,date_trunc('week',created_at at time zone 'America/Sao_Paulo')::date,
        (detail->>'quota_used')::bigint,0::bigint,'confirmed' from blog_worker.operator_event e where e.action='google_diagnostic_usage' and not exists (
          select 1 from blog_worker.attempt a where e.actor_id='google_editorial_pilot'
          and e.detail->>'purpose'='Authorized real editorial batch; legacy-compatible usage accounting'
          and e.target=a.id::text and a.provider='google_subscription' and a.state='confirmed'
          and e.detail->>'usage_known'='true' and e.detail->>'kind'=a.kind
          and (e.detail->>'quota_used')::bigint=a.quota_used and e.detail->'usage'=a.usage
          and a.day=(e.created_at at time zone 'America/Sao_Paulo')::date)
    ) q`;
  const [{ multisource_ready }] = await sql<{ multisource_ready: boolean }[]>`select to_regclass('blog_worker.quota_observation') is not null as multisource_ready`;
  const quotaObservations = multisource_ready ? await sql<{ stage: string; minimum_fraction: number; created_at: Date }[]>`select stage,minimum_fraction,created_at from blog_worker.quota_observation order by id desc limit 10` : [];
  const topicUsage = multisource_ready ? await sql<{ category: string | null; subcategory: string | null; calls: number; tokens: string }[]>`select d.document->>'category' as category,d.document->>'subcategory' as subcategory,count(*)::int as calls,
    sum(coalesce(a.quota_used,a.quota_reserved))::text as tokens from blog_worker.attempt a left join blog_worker.dossier_version d on d.candidate_id=a.candidate_id and d.revision=a.dossier_revision
    where a.provider='google_subscription' and a.day=(now() at time zone 'America/Sao_Paulo')::date group by 1,2` : [];
  return { subscription: subscription ?? null, quota, control, sources, candidates, total, commands, attempts, counts, usage, benefit: benefit ?? null, multisource_ready, quotaObservations, topicUsage };
}

// These writes enqueue work only. The web process never receives a provider credential.
export async function savePipelineSource(actor: string, definition: PipelineSource, revision: number) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    let rows;
    if (revision === 0) {
      const [{ count }] = await tx`select count(*)::int as count from blog_worker.source_catalog`;
      if (count >= 40) return false;
      rows = await tx`insert into blog_worker.source_catalog(id,definition) values(${definition.id},${JSON.stringify(definition)}::jsonb) on conflict do nothing returning id`;
    } else rows = await tx`update blog_worker.source_catalog set definition=${JSON.stringify(definition)}::jsonb,revision=revision+1,updated_at=now() where id=${definition.id} and revision=${revision} returning id`;
    if (!rows.length) return false;
    await tx`insert into blog_worker.operator_event(actor_id,action,target,detail) values(${actor},'source_saved',${definition.id},${JSON.stringify({ revision: revision + 1, enabled: definition.enabled, feed_content_approved: definition.feed_content_approved })}::jsonb)`;
    return true;
  });
}
export async function enqueuePipeline(actor: string, kind: "collect" | "generate", candidateId: string | null) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [control] = await tx`select * from blog_worker.control where singleton=true for update`;
    if (kind === "generate") {
      if (control.paused || !candidateId) return false;
      const [c] = await tx`select c.status,j.state as image_state from blog_worker.candidate c left join blog_worker.image_job j on c.id=j.candidate_id where c.id=${candidateId}`;
      if (!c || !(c.status === "ready" || (c.status === "draft" && c.image_state === "pending"))) return false;
    }
    if ((await tx`select id from blog_worker.command where state in ('queued','running')`).length) return false;
    await tx`insert into blog_worker.command(id,kind,candidate_id,actor_id) values(${randomUUID()},${kind},${candidateId},${actor})`;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},${kind === "collect" ? "collection_requested" : "generation_requested"},${candidateId})`;
    return true;
  });
}
export async function setPipelinePaused(actor: string, paused: boolean) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    if (!paused && (await tx`select id from blog_worker.attempt where state in ('reserved','unknown') or charged_micro_usd>reserved_micro_usd or quota_used>quota_reserved limit 1`).length) return false;
    await tx`update blog_worker.control set paused=${paused},reason=${paused ? "operator_pause" : null},updated_at=now() where singleton=true`;
    await tx`insert into blog_worker.operator_event(actor_id,action) values(${actor},${paused ? "paused" : "resumed"})`;
    return true;
  });
}
export async function holdPipelineCandidate(actor: string, id: string, held: boolean) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const rows = await tx`update blog_worker.candidate c set status=${held ? "held" : "ready"},reason=${held ? "operator_hold" : null}
      where id=${id} and post_id is null and jsonb_array_length(evidence)>0
      and (status='ready' or (status='held' and reason='operator_hold'))
      and not exists(select 1 from blog_worker.attempt a where a.candidate_id=c.id) returning id`;
    if (!rows.length) return false;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},${held ? "candidate_held" : "candidate_released"},${id})`;
    return true;
  });
}
export async function editPipelineCover(actor: string, cover: { candidate_id: string; prompt: string; alt: string; caption: string }) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const rows = await tx`update blog_worker.image_job set prompt=${cover.prompt},alt=${cover.alt},caption=${cover.caption},updated_at=now()
      where candidate_id=${cover.candidate_id} and state='pending' returning candidate_id`;
    if (!rows.length) return false;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},'cover_brief_saved',${cover.candidate_id})`;
    return true;
  });
}
export async function applyReviewedCover(actor: string, candidateId: string, revision: number) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const [job] = await tx`select * from blog_worker.image_job where candidate_id=${candidateId} and state='review' for update`;
    if (!job) return false;
    const [post] = await tx`select revision,status from public.blog_post where id=${job.post_id} for update`;
    if (!post || post.status !== "draft" || post.revision !== revision) return false;
    await tx`update blog_worker.image_job set expected_revision=${revision} where candidate_id=${candidateId}`;
    const [{ media }] = await tx`select blog_worker.import_cover(${candidateId},${randomUUID()}) as media`;
    if (!media) return false;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},'cover_reviewed',${candidateId})`;
    return true;
  });
}
