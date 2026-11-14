import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import type { PipelineSource } from "./pipeline-validation";
import explainerCatalog from "./explainer-catalog.json";

export type PipelineSnapshot = { provider: string; account_email: string | null; daily_calls_cap: number; weekly_calls_cap: number; daily_tokens_cap: number; weekly_tokens_cap: number; generation_enabled: boolean; images_enabled: boolean; operator_commands_only: boolean; automatic_access_validation?: boolean; automatic_explainers?: boolean; explainer_after_local_hour?: number | null; model: string; image_model: string | null; organization_id: string | null; project_id: string | null; article_cap: number; daily_cap: number; cycle_cap: number; cycle_fraction: number; per_day: number; per_week: number };
export type Evidence = { id: string; title: string; text: string; url: string; rights_reference: string };
export type SourceDiscovery = { registered: {url: string; name: string; publisher: string; kind: string}[]; unregistered: {url: string; host: string}[]; images: {url: string; source_url: string; alt: string; credit: string | null; license_url: string | null; rights_status: string}[] };
export type PipelineCandidate = { source_discovery?: SourceDiscovery | null; id: string; title: string; url: string; editoria: string; source_id: string; content_kind: string; status: string; generation_ready: boolean; reason: string | null; post_id: number | null; published_at: Date; evidence: Evidence[]; image_state: string | null; image_reason: string | null; prompt: string | null; alt: string | null; caption: string | null; media_id: string | null; topic_category: string | null; topic_subcategory: string | null; research_stage: string | null; research_at: string | null; research_next_at: string | null; post_revision: number | null; post_title: string | null; post_status: string | null; body: string | null; seo_title: string | null; seo_description: string | null; seo_noindex: boolean | null };
export type PipelineCommand = { id: string; kind: string; state: string; created_at: Date; result: { generation?: { reason?: string }; image?: { reason?: string } } | null };
export type PipelineAttempt = { id: string; candidate_id: string; kind: string; state: string; provider: string; quota_reserved: string; quota_used: string | null; model: string; charged: string | null; reserved: string; reason: string | null; created_at: Date };
export async function getPipelineDashboard(page = 1) {
  const sql = getSql();
  const [{ ready, dossiers_ready }] = await sql<{ ready: boolean; dossiers_ready: boolean }[]>`select to_regclass('blog_worker.subscription') is not null as ready,to_regclass('blog_worker.dossier_version') is not null as dossiers_ready`;
  if (!ready) return null;
  const [control] = await sql<{ paused: boolean; reason: string | null; snapshot: PipelineSnapshot | null; heartbeat_at: Date | null; alive: boolean }[]>`select paused,reason,snapshot,heartbeat_at,coalesce(heartbeat_at between now()-interval '4 minutes' and now(),false) as alive from blog_worker.control where singleton=true`;
  const sources = await sql<{ id: string; definition: PipelineSource; revision: number; last_collected_at: Date | null; last_result: string | null }[]>`select c.id,c.definition,c.revision,s.last_collected_at,s.last_result from blog_worker.source_catalog c left join blog_worker.source_state s using(id) order by c.id`;
  const candidates = await sql<PipelineCandidate[]>`select c.id,c.title,c.url,c.editoria,c.source_id,c.content_kind,c.status,c.reason,c.post_id,c.published_at,c.evidence,c.artifact->'research'->'source_discovery' as source_discovery,c.artifact->'research'->'topic'->>'category' as topic_category,c.artifact->'research'->'topic'->>'subcategory' as topic_subcategory,c.artifact->'research'->>'stage' as research_stage,c.artifact->'research'->>'at' as research_at,c.artifact->'research'->>'next_at' as research_next_at,
    j.state as image_state,j.reason as image_reason,j.prompt,j.alt,j.caption,j.media_id,b.revision as post_revision,b.title as post_title,b.status as post_status,b.body,b.seo_title,b.seo_description,b.seo_noindex
    from blog_worker.candidate c left join blog_worker.image_job j on j.candidate_id=c.id left join public.blog_post b on b.id=c.post_id
    order by c.created_at desc,c.id limit 20 offset ${(page - 1) * 20}`;
  const dossiers = dossiers_ready && candidates.length ? await sql<{ id: string; category: string; subcategory: string | null; verified: boolean }[]>`select c.id,d.document->>'category' as category,d.document->>'subcategory' as subcategory,
    coalesce(c.status='ready' and c.post_id is null and d.source_hash=c.evidence_hash and d.assessment->>'eligible'='true' and d.assessment->>'comparison_verified'='true',false) as verified
    from blog_worker.candidate c join lateral (select source_hash,assessment,document from blog_worker.dossier_version where candidate_id=c.id order by revision desc limit 1) d on true
    where c.id=any(${candidates.map(c => c.id)}::text[])` : [];
  const dossierById = new Map(dossiers.map(d => [d.id, d]));
  for (const c of candidates) {
    const d = dossierById.get(c.id);
    c.generation_ready = c.status === "ready" && (control.snapshot?.provider !== "google_subscription" || d?.verified === true);
    if (d) { c.topic_category = d.category; c.topic_subcategory = d.subcategory; }
  }
  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from blog_worker.candidate`;
  const [{ total_posts }] = await sql<{ total_posts: number }[]>`select count(*)::int as total_posts from public.blog_post`;
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
  const [{ access_ready }] = await sql<{ access_ready: boolean }[]>`select to_regclass('blog_worker.google_access') is not null as access_ready`;
  const [googleAccess] = access_ready ? await sql<{ state: string; checked_at: Date | null; succeeded_at: Date | null; valid_until: Date | null; next_check_at: Date; reason: string | null; valid: boolean }[]>`select a.state,a.checked_at,a.succeeded_at,a.valid_until,a.next_check_at,a.reason,
    coalesce(a.state='valid' and a.valid_until>now() and a.binding_hash=encode(sha256(convert_to(blog_worker.canonical_json(s.attestation),'UTF8')),'hex'),false) as valid
    from blog_worker.google_access a join blog_worker.subscription s using(singleton) where a.singleton=true` : [];
  const production = dossiers_ready ? await sql<{ category: string; subcategory: string | null; drafts: number; complete: number; researching: number; compared: number; primary_pending: number; independent_pending: number; unavailable: number; format_pending: number; factual_pending: number; review_held: number; news: number; explainers: number }[]>`
    with scope as (select c.id,c.post_id,c.content_kind,c.status,c.evidence_hash,c.artifact,c.published_at,c.reason,v.source_hash,v.document,v.assessment,j.state as image_state,
      exists(select 1 from blog_worker.attempt a where a.candidate_id=c.id and a.kind='text' and a.state='confirmed' and a.reason is null and a.day=(now() at time zone 'America/Sao_Paulo')::date) as today
      from blog_worker.candidate c left join lateral(select source_hash,document,assessment from blog_worker.dossier_version where candidate_id=c.id order by revision desc limit 1) v on true
      left join blog_worker.image_job j on j.candidate_id=c.id)
    select coalesce(document->>'category',artifact->'research'->'topic'->>'category') as category,
      case when document is not null then document->>'subcategory' else artifact->'research'->'topic'->>'subcategory' end as subcategory,
      count(*) filter(where today and post_id is not null)::int as drafts,
      count(*) filter(where today and post_id is not null and content_kind='news')::int as news,
      count(*) filter(where today and post_id is not null and content_kind='explainer')::int as explainers,
      count(*) filter(where today and post_id is not null and image_state='completed')::int as complete,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and artifact->'research' is not null)::int as researching,
      count(*) filter(where post_id is null and status='ready' and published_at>now()-interval '7 days' and source_hash=evidence_hash and reason is distinct from 'operator_hold' and reason is distinct from 'source_changed_after_reservation' and assessment->>'eligible'='true' and assessment->>'comparison_verified'='true')::int as compared,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and artifact->'research'->>'stage' in ('research_primary_missing','research_reference_unregistered','research_primary_stale'))::int as primary_pending,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and artifact->'research'->>'stage'='research_independent_missing')::int as independent_pending,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and artifact->'research'->>'stage' in ('research_source_unavailable','research_robots_disallowed','research_access_restricted','research_article_missing','research_text_insufficient','research_excerpt_disallowed'))::int as unavailable,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and reason in ('invalid_structure','invalid_comparison','invalid_claim','invalid_claim_cell','invalid_dossier','duplicate_claim','quote_not_in_document'))::int as format_pending,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and assessment->>'comparison_verified'='true' and assessment->>'eligible'='false')::int as factual_pending,
      count(*) filter(where post_id is null and published_at>now()-interval '7 days' and reason in ('operator_hold','source_changed_after_reservation'))::int as review_held
      from scope group by 1,2` : [];
  const [{ research_ready }] = await sql<{ research_ready: boolean }[]>`select to_regclass('blog_worker.research_reference') is not null as research_ready`;
  const planned = await sql<{explainer_key: string; post_id: number | null; status: string; reason: string | null}[]>`select explainer_key,post_id,status,reason from blog_worker.candidate where content_kind='explainer'`;
  const explainers = explainerCatalog.map(p => ({...p, candidate: planned.find(c => c.explainer_key === p.key) ?? null}));
  return { production, explainers, research_ready, googleAccess: googleAccess ?? null, subscription: subscription ?? null, quota, control, sources, candidates, total, totalPosts: total_posts, commands, attempts, counts, usage, benefit: benefit ?? null, multisource_ready, quotaObservations, topicUsage };
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
      if (c.status === "ready" && control.snapshot?.provider === "google_subscription") {
        const [{ ready }] = await tx`select to_regclass('blog_worker.dossier_version') is not null as ready`;
        if (!ready) return false;
        const [verified] = await tx`select c.id from blog_worker.candidate c
          join lateral (select source_hash,assessment from blog_worker.dossier_version where candidate_id=c.id order by revision desc limit 1) d on true
          where c.id=${candidateId} and c.post_id is null and d.source_hash=c.evidence_hash
          and d.assessment->>'eligible'='true' and d.assessment->>'comparison_verified'='true'`;
        if (!verified) return false;
      }
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
