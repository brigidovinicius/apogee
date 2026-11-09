import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {actualUsageCost,assertWindow,cycleCap,fail,hash,periodKeys,selectPrice,usageCost,validateGrant,validatePolicy,validateSubscription,subscriptionUsage} from './policy.mjs';
import {buildRequest,cacheKey,cmsDraft,validateArticle} from './editorial.mjs';
import {coverBrief,imageRequest,imageCost,imageUsageCost,selectImagePrice,validateWebp} from './images.mjs';

export async function migrate(sql) {
  const sources=await Promise.all(['001-initial.sql','002-editorial-images.sql','003-google-subscription.sql'].map(f=>readFile(new URL('../sql/'+f,import.meta.url),'utf8')));
  return sql.begin(async tx=>{
    await tx`select pg_advisory_xact_lock(174911,601)`;
    const [{exists}]=await tx`select to_regclass('blog_worker.migration') is not null as exists`;
    const rows=exists?await tx`select version,sha256 from blog_worker.migration order by version`:[];
    if(rows.some((r,i)=>r.version!==i+1||r.sha256!==hash(sources[i]??''))||rows.length>sources.length)fail('migration_drift');
    if(rows.length===sources.length)return 'already_applied';
    const [{cms}]=await tx`select to_regclass('public.blog_post') is not null and to_regclass('public.blog_post_event') is not null as cms`;
    if(!cms)fail('cms_missing');
    for(let i=rows.length;i<sources.length;i++){
      await tx.unsafe(sources[i]);await tx`insert into blog_worker.migration(version,sha256) values(${i+1},${hash(sources[i])})`;
    }return 'applied';
  });
}
export const n=value=>{const num=Number(value);if(!Number.isSafeInteger(num)||num<0)fail('invalid_ledger');return num;};
const benefit=row=>row?{...row.attestation,...row,provider_grant_id:row.id,amount_micro_usd:n(row.amount_micro_usd),remaining_micro_usd:n(row.remaining_micro_usd)}:null;
export async function lock(tx) {
  const [control]=await tx`select * from blog_worker.control where singleton=true for update`;
  if(!control)fail('control_missing');
  const [{at}]=await tx`select clock_timestamp() as at`;return {control,at};
}
export class Store {
  constructor(sql){this.sql=sql;}
  async attestSubscription(record){
    return this.sql.begin(async tx=>{const {at}=await lock(tx);validateSubscription(record,at);
      await tx`insert into blog_worker.subscription(singleton,account_email,plan,verified_at,valid_until,attestation) values(true,${record.account_email},${record.plan},${record.verified_at},${record.valid_until},${tx.json(record)}) on conflict(singleton) do update set account_email=excluded.account_email,plan=excluded.plan,verified_at=excluded.verified_at,valid_until=excluded.valid_until,attestation=excluded.attestation`;
      return {status:'subscription_verified',valid_until:record.valid_until};});
  }
  async attestGrant(g,identity) {
    return this.sql.begin(async tx=>{
      const {at}=await lock(tx);validateGrant(g,at,identity);
      const [old]=await tx`select * from blog_worker.benefit where id=${g.provider_grant_id}`;
      if(old && (old.organization_id!==g.organization_id||old.project_id!==g.project_id||n(old.amount_micro_usd)!==g.amount_micro_usd
        || +old.starts_at!==Date.parse(g.starts_at)||+old.expires_at!==Date.parse(g.expires_at)||old.revoked_at))fail('immutable_grant');
      const overlaps=await tx`select id from blog_worker.benefit where id<>${g.provider_grant_id}
        and starts_at<${g.expires_at} and expires_at>${g.starts_at}`;
      if(overlaps.length)fail('overlapping_cycle');
      await tx`insert into blog_worker.benefit(id,organization_id,project_id,starts_at,expires_at,amount_micro_usd,remaining_micro_usd,verified_at,attestation)
        values(${g.provider_grant_id},${g.organization_id},${g.project_id},${g.starts_at},${g.expires_at},${g.amount_micro_usd},${g.remaining_micro_usd},${g.verified_at},${tx.json(g)})
        on conflict(id) do update set remaining_micro_usd=excluded.remaining_micro_usd,verified_at=excluded.verified_at,attestation=excluded.attestation`;
      return {status:'grant_recorded',id:g.provider_grant_id};
    });
  }
  async claimSource(source) {
    await this.sql`insert into blog_worker.source_state(id) values(${source.id}) on conflict do nothing`;
    const [state]=await this.sql`update blog_worker.source_state set next_due_at=now()+(${source.interval_minutes}*interval '1 minute')
      where id=${source.id} and next_due_at<=now() returning *`;
    return state??null;
  }
  async sourceResult(id,result,headers={}) {
    await this.sql`update blog_worker.source_state set last_collected_at=now(),last_result=${result},
      etag=coalesce(${headers.etag??null},etag),last_modified=coalesce(${headers.lastModified??null},last_modified),
      failures=case when ${result}='feed_error' then least(20,failures+1) else 0 end,
      next_due_at=case when ${result}='feed_error' then greatest(next_due_at,
        now()+least(86400,3600*power(2,failures))*interval '1 second',
        now()+${Math.min(604800,Math.max(0,Number.isSafeInteger(headers.retryAfter)?headers.retryAfter:0))}*interval '1 second') else next_due_at end where id=${id}`;
  }
  async maintenance() {
    // Only disposable, never-generated candidates. Evidence supporting any attempt/draft stays intact.
    await this.sql`update blog_worker.candidate set evidence='[]'::jsonb,status='held',reason='retention'
      where id in (select c.id from blog_worker.candidate c where c.created_at<now()-interval '30 days'
        and c.post_id is null and c.evidence<>'[]'::jsonb and not exists(select 1 from blog_worker.attempt a where a.candidate_id=c.id) limit 200)`;
    await this.sql`delete from blog_worker.candidate where id in
      (select c.id from blog_worker.candidate c where c.created_at<now()-interval '180 days' and c.post_id is null
        and not exists(select 1 from blog_worker.attempt a where a.candidate_id=c.id) limit 200)`;
    const [{bytes}]=await this.sql`select coalesce(sum(pg_total_relation_size(c.oid)),0)::text as bytes
      from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='blog_worker' and c.relkind='r'`;
    return {bytes:n(bytes),capture_allowed:n(bytes)<1073741824};
  }
  async ingest(c) {
    return this.sql.begin(async tx=>{
      const inserted=await tx`insert into blog_worker.candidate(id,source_id,guid,url,event_key,title,editoria,score,published_at,evidence,evidence_hash,status)
        values(${c.id},${c.source_id},${c.guid},${c.url},${c.event_key},${c.title},${c.editoria},${c.score},${c.published_at},${tx.json(c.evidence)},${c.evidence_hash},${c.status}) on conflict do nothing returning id`;
      if(inserted.length)return 'created';
      // Preserve dossiers already used by a reservation or reviewed draft. Changed evidence requires human assessment.
      const [current]=await tx`select * from blog_worker.candidate where id=${c.id} for update`;
      if(current && current.evidence_hash!==c.evidence_hash){
        const [used]=await tx`select id from blog_worker.attempt where candidate_id=${c.id} limit 1`;
        if(!used && current.source_id===c.source_id)await tx`update blog_worker.candidate set evidence=${tx.json(c.evidence)},evidence_hash=${c.evidence_hash},status=${c.status} where id=${c.id}`;
        else await tx`update blog_worker.candidate set reason='source_changed_after_reservation' where id=${c.id}`;
      }
      return 'duplicate';
    });
  }
  async recover() {
    return this.sql.begin(async tx=>{
      await lock(tx);
      const stale=await tx`update blog_worker.attempt set state='unknown',reason='worker_interrupted' where state='reserved' and created_at<now()-interval '5 minutes' returning candidate_id`;
      if(stale.length){
        await tx`update blog_worker.control set paused=true,reason='unknown_charge',updated_at=now() where singleton=true`;
        await tx`update blog_worker.candidate set status='held',reason='unknown_charge' where id in ${tx(stale.map(r=>r.candidate_id))}`;
        await tx`update blog_worker.image_job set state='held',reason='unknown_charge',updated_at=now() where state='reserved' and candidate_id in ${tx(stale.map(r=>r.candidate_id))}`;
      }
      return stale.length;
    });
  }
  async reserve({policy,catalog,identity,sources,candidateId=null}) {
    validatePolicy(policy);
    if(!policy.generation_enabled)fail('generation_disabled');
    return this.sql.begin(async tx=>{
      const {at,control}=await lock(tx);
      if(control.paused)fail('paused');
      const google=policy.provider==='google_subscription';
      const price=google?{model:policy.model_id,provider:policy.provider,billing_mode:'subscription_no_overages'}:selectPrice(catalog,policy,at);assertWindow(at);
      let grant;
      if(google)await subscriptionBudget(tx,policy,at);
      else {
        const rows=await tx`select * from blog_worker.benefit where starts_at<=${at} and expires_at>${at} and revoked_at is null`;
        if(rows.length!==1)fail('benefit_unverified');grant=validateGrant(benefit(rows[0]),at,identity);
      }
      const [pending]=await tx`select id from blog_worker.attempt where state in ('reserved','unknown') limit 1`;
      if(pending)fail('request_pending');
      const enabled=sources.filter(s=>s.enabled && s.feed_content_approved && s.rights_reference);
      if(!enabled.length)fail('no_approved_sources');
      const [candidate]=await tx`select c.* from blog_worker.candidate c
        where c.status='ready' and c.reason is distinct from 'source_changed_after_reservation'
        and (${candidateId}::text is null or c.id=${candidateId})
        and c.source_id in ${tx(enabled.map(s=>s.id))} and c.published_at>now()-interval '7 days'
        order by (select count(*) from blog_worker.candidate d where d.editoria=c.editoria and d.status='draft' and d.created_at>now()-interval '28 days') asc,
        c.score desc,c.published_at desc,c.id asc limit 1 for update`;
      if(!candidate)return {status:'idle'};
      const source=enabled.find(s=>s.id===candidate.source_id);
      if(candidate.evidence.some(e=>e.rights_reference!==source.rights_reference))fail('source_approval_changed');
      const {day,week}=periodKeys(at);
      const [counts]=await tx`select count(*) filter(where first_attempt_day=${day}::date)::int as day,
        count(*) filter(where first_attempt_week=${week}::date)::int as week from blog_worker.candidate`;
      if(!candidate.first_attempt_day && (counts.day>=policy.new_drafts_per_day_cap||counts.week>=policy.new_drafts_per_week_cap))fail('draft_frequency');
      const attempts=await tx`select * from blog_worker.attempt where candidate_id=${candidate.id} and kind='text'`;
      if(attempts.length>=policy.max_provider_attempts_per_article_including_repairs)fail('attempt_limit');
      const body=buildRequest(candidate,policy,attempts.length>0),key=cacheKey(candidate,policy);
      const reserve=google?0:usageCost(price,policy.input_tokens_cap_including_overhead,policy.billed_output_tokens_cap_including_reasoning);
      const [spent]=await tx`select
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where benefit_id=${grant?.id??null}),0) as cycle,
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where day=${day}::date),0) as day,
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where candidate_id=${candidate.id}),0) as article
        from blog_worker.attempt`;
      if(!google && (n(spent.cycle)+reserve>cycleCap(policy,grant) || n(spent.cycle)+reserve>grant.remaining_micro_usd-(grant.credit_safety_buffer_micro_usd??0)))fail('cycle_budget');
      if(!google && n(spent.day)+reserve>policy.daily_budget_micro_usd_cap)fail('daily_budget');
      if(!google && n(spent.article)+reserve>policy.article_budget_micro_usd_cap_including_all_attempts)fail('article_budget');
      const id=randomUUID();
      await tx`insert into blog_worker.attempt(id,candidate_id,benefit_id,ordinal,cache_key,request_hash,price,policy,day,week,state,reserved_micro_usd,provider,quota_reserved)
        values(${id},${candidate.id},${grant?.id??null},${attempts.length+1},${key},${hash(body)},${tx.json(price)},${tx.json(policy)},${day},${week},'reserved',${reserve},${google?'google_subscription':'openai_api'},${google?policy.google_tokens_reserved_per_call:0})`;
      await tx`update blog_worker.candidate set first_attempt_day=coalesce(first_attempt_day,${day}::date),
        first_attempt_week=coalesce(first_attempt_week,${week}::date) where id=${candidate.id}`;
      return {status:'reserved',id,candidate,body,reserved_micro_usd:reserve,policy,identity,not_after:new Date(+at+180000).toISOString()};
    });
  }
  async finish(reservation,result) {
    if(reservation.kind==='image')return this.finishImage(reservation,result);
    return this.sql.begin(async tx=>{
      await lock(tx);
      const [attempt]=await tx`select * from blog_worker.attempt where id=${reservation.id} for update`;
      if(!attempt || attempt.state!=='reserved')fail('stale_completion');
      const [candidate]=await tx`select * from blog_worker.candidate where id=${attempt.candidate_id} for update`;
      const hold=async reason=>{
        await tx`update blog_worker.attempt set state='unknown',reason=${reason} where id=${attempt.id}`;
        await tx`update blog_worker.candidate set status='held',reason=${reason} where id=${candidate.id}`;
        await tx`update blog_worker.control set paused=true,reason=${reason},updated_at=now() where singleton=true`;
        return {status:'held',reason,reserved_micro_usd:n(attempt.reserved_micro_usd)};
      };
      if(result.outcome==='unknown')return hold(attempt.provider==='google_subscription'?(result.reason??'google_execution_unknown'):'unknown_charge');
      const google=attempt.provider==='google_subscription';let cost,quota=0;
      try{
        if(result.outcome==='not_sent')cost=0;
        else if(google){cost=0;quota=subscriptionUsage(result.usage);}
        else {
          if(result.usage?.total_tokens!==result.usage?.input_tokens+result.usage?.output_tokens)fail('invalid_usage');
          cost=actualUsageCost(attempt.price,result.usage);
        }
      }catch{return hold('invalid_usage');}
      await tx`update blog_worker.attempt set state='confirmed',charged_micro_usd=${cost},quota_used=${google?quota:null},usage=${tx.json(result.usage??{})},finished_at=now() where id=${attempt.id}`;
      if((google && quota>n(attempt.quota_reserved)) || (!google && (cost>n(attempt.reserved_micro_usd) || (result.usage?.input_tokens??0)>attempt.policy.input_tokens_cap_including_overhead
        || (result.usage?.output_tokens??0)>attempt.policy.billed_output_tokens_cap_including_reasoning))){
        await tx`update blog_worker.control set paused=true,reason='usage_exceeded_reservation',updated_at=now() where singleton=true`;
        await tx`update blog_worker.candidate set status='held',reason='usage_exceeded_reservation' where id=${candidate.id}`;
        return {status:'held',reason:'usage_exceeded_reservation',charged_micro_usd:cost};
      }
      let article,reason=result.reason;
      if(result.outcome==='completed'){
        try{article=validateArticle(JSON.parse(result.text),candidate.evidence);}catch(error){reason=error.code??'invalid_structure';}
      }
      if(!article){
        const retry=reason==='invalid_structure'&&attempt.ordinal<attempt.policy.max_provider_attempts_per_article_including_repairs;
        await tx`update blog_worker.candidate set status=${retry?'ready':'held'},reason=${reason??'invalid_response'} where id=${candidate.id}`;
        await tx`update blog_worker.attempt set reason=${reason??'invalid_response'} where id=${attempt.id}`;
        return {status:retry?'repair_pending':'held',reason:reason??'invalid_response',charged_micro_usd:cost};
      }
      if(hash(candidate.evidence)!==candidate.evidence_hash || candidate.reason==='source_changed_after_reservation')return holdAfterCharge(tx,candidate.id,cost);
      const draft=cmsDraft(candidate,article);
      const [{post_id}]=await tx`select blog_worker.import_draft(${candidate.id},${tx.json(draft)}) as post_id`;
      await tx`update blog_worker.candidate set artifact=${tx.json({article,evidence:candidate.evidence,cache_key:attempt.cache_key,human_review_required:true})} where id=${candidate.id}`;
      if(attempt.policy.automatic_image_generation_enabled){
        const brief=coverBrief(article);
        await tx`select blog_worker.queue_cover(${candidate.id},${brief.prompt},${brief.alt},${brief.caption})`;
      }
      return {status:'draft',post_id,charged_micro_usd:cost};
    });
  }
  async reserveImage({policy,catalog,identity,sources,candidateId=null}) {
    validatePolicy(policy);
    if(!policy.generation_enabled)fail('generation_disabled');
    return this.sql.begin(async tx=>{
      const {at,control}=await lock(tx);if(control.paused)fail('paused');assertWindow(at);
      const google=policy.provider==='google_subscription';
      const price=google?{model:policy.image_model_id,provider:policy.provider,billing_mode:'subscription_no_overages'}:selectImagePrice(catalog,policy,at);
      let grant;
      if(google)await subscriptionBudget(tx,policy,at);
      else {const rows=await tx`select * from blog_worker.benefit where starts_at<=${at} and expires_at>${at} and revoked_at is null`;
        if(rows.length!==1)fail('benefit_unverified');grant=validateGrant(benefit(rows[0]),at,identity);}
      if((await tx`select id from blog_worker.attempt where state in ('reserved','unknown') limit 1`).length)fail('request_pending');
      const [job]=await tx`select j.*,c.source_id,c.reason as candidate_reason,c.evidence,c.evidence_hash from blog_worker.image_job j
        join blog_worker.candidate c on c.id=j.candidate_id where j.state='pending'
        and (${candidateId}::text is null or j.candidate_id=${candidateId}) order by j.created_at limit 1 for update of j`;
      if(!job)return {status:'idle'};
      const source=sources.find(s=>s.id===job.source_id&&s.enabled&&s.feed_content_approved);
      if(!source || job.candidate_reason==='source_changed_after_reservation' || job.evidence.some(e=>e.rights_reference!==source.rights_reference))fail('source_approval_changed');
      if((await tx`select id from blog_worker.attempt where candidate_id=${job.candidate_id} and kind='image'`).length)fail('image_attempt_limit');
      const body=google?{prompt:job.prompt}:imageRequest(job,policy),reserve=google?0:imageCost(price,policy.image_input_tokens_cap,policy.image_output_tokens_reservation);
      const {day,week}=periodKeys(at);
      const [spent]=await tx`select
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where benefit_id=${grant?.id??null}),0) as cycle,
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where day=${day}::date),0) as day,
        coalesce(sum(coalesce(charged_micro_usd,reserved_micro_usd)) filter(where candidate_id=${job.candidate_id}),0) as article from blog_worker.attempt`;
      if(!google && (n(spent.cycle)+reserve>cycleCap(policy,grant)||n(spent.cycle)+reserve>grant.remaining_micro_usd-(grant.credit_safety_buffer_micro_usd??0)))fail('cycle_budget');
      if(!google && n(spent.day)+reserve>policy.daily_budget_micro_usd_cap)fail('daily_budget');
      if(!google && n(spent.article)+reserve>policy.article_budget_micro_usd_cap_including_all_attempts)fail('article_budget');
      const id=randomUUID();
      await tx`insert into blog_worker.attempt(id,candidate_id,benefit_id,kind,ordinal,cache_key,request_hash,price,policy,day,week,state,reserved_micro_usd,provider,quota_reserved)
        values(${id},${job.candidate_id},${grant?.id??null},'image',1,${hash(body)},${hash(body)},${tx.json(price)},${tx.json(policy)},${day},${week},'reserved',${reserve},${google?'google_subscription':'openai_api'},${google?policy.google_tokens_reserved_per_call:0})`;
      await tx`update blog_worker.image_job set state='reserved',updated_at=now() where candidate_id=${job.candidate_id}`;
      return {status:'reserved',kind:'image',id,candidate_id:job.candidate_id,body,policy,identity,reserved_micro_usd:reserve,not_after:new Date(+at+180000).toISOString()};
    });
  }
  async finishImage(reservation,result) {
    return this.sql.begin(async tx=>{
      await lock(tx);
      const [attempt]=await tx`select * from blog_worker.attempt where id=${reservation.id} and kind='image' for update`;
      if(!attempt||attempt.state!=='reserved')fail('stale_completion');
      const hold=async reason=>{
        await tx`update blog_worker.attempt set state='unknown',reason=${reason} where id=${attempt.id}`;
        await tx`update blog_worker.image_job set state='held',reason=${reason},updated_at=now() where candidate_id=${attempt.candidate_id}`;
        await tx`update blog_worker.control set paused=true,reason=${reason},updated_at=now() where singleton=true`;
        return {status:'held',reason,reserved_micro_usd:n(attempt.reserved_micro_usd)};
      };
      const google=attempt.provider==='google_subscription';
      if(result.outcome==='unknown')return hold(google?(result.reason??'google_execution_unknown'):'unknown_image_charge');
      let cost=0,quota=0;
      try{if(result.outcome!=='not_sent'){if(google)quota=subscriptionUsage(result.usage);else cost=imageUsageCost(attempt.price,result.usage);}}catch{return hold('invalid_image_usage');}
      await tx`update blog_worker.attempt set state='confirmed',charged_micro_usd=${cost},quota_used=${google?quota:null},usage=${tx.json(result.usage??{})},finished_at=now() where id=${attempt.id}`;
      let reason=result.reason;
      if((google && quota>n(attempt.quota_reserved)) || (!google && (cost>n(attempt.reserved_micro_usd)||(result.usage?.input_tokens??0)>attempt.policy.image_input_tokens_cap
        ||(result.usage?.output_tokens??0)>attempt.policy.image_output_tokens_reservation))){
        reason='usage_exceeded_reservation';await tx`update blog_worker.control set paused=true,reason=${reason},updated_at=now() where singleton=true`;
      }
      if(result.outcome==='completed'&&!reason)try{validateWebp(result.image);}catch{reason='invalid_image';}
      const [candidate]=await tx`select * from blog_worker.candidate where id=${attempt.candidate_id}`;
      if(candidate.reason==='source_changed_after_reservation'||hash(candidate.evidence)!==candidate.evidence_hash)reason='evidence_changed';
      if(reason||result.outcome!=='completed'){
        reason??='invalid_image';
        await tx`update blog_worker.image_job set state='held',reason=${reason},updated_at=now() where candidate_id=${attempt.candidate_id}`;
        await tx`update blog_worker.attempt set reason=${reason} where id=${attempt.id}`;
        return {status:'held',reason,charged_micro_usd:cost};
      }
      await tx`update blog_worker.image_job set image=${result.image},state='review',updated_at=now() where candidate_id=${attempt.candidate_id}`;
      const [{media_id}]=await tx`select blog_worker.import_cover(${attempt.candidate_id},${randomUUID()}) as media_id`;
      if(!media_id)await tx`update blog_worker.image_job set reason='post_changed_requires_review' where candidate_id=${attempt.candidate_id}`;
      return {status:media_id?'cover_ready':'cover_review',post_id:candidate.post_id,media_id,charged_micro_usd:cost};
    });
  }
  async syncPipeline(config,identity) {
    return this.sql.begin(async tx=>{
      await lock(tx);
      for(const s of config.sources)await tx`insert into blog_worker.source_catalog(id,definition) values(${s.id},${tx.json(s)}) on conflict do nothing`;
      const snapshot={provider:config.policy.provider,account_email:config.policy.google_account_email??null,daily_calls_cap:config.policy.google_daily_calls_cap??0,weekly_calls_cap:config.policy.google_weekly_calls_cap??0,daily_tokens_cap:config.policy.google_daily_tokens_cap??0,weekly_tokens_cap:config.policy.google_weekly_tokens_cap??0,generation_enabled:config.policy.generation_enabled,images_enabled:config.policy.automatic_image_generation_enabled,
        operator_commands_only:config.policy.operator_commands_only===true,model:config.policy.model_id,image_model:config.policy.image_model_id??null,
        organization_id:identity?.organization_id??null,project_id:identity?.project_id??null,
        article_cap:config.policy.article_budget_micro_usd_cap_including_all_attempts,daily_cap:config.policy.daily_budget_micro_usd_cap,
        cycle_cap:config.policy.cycle_budget_micro_usd_cap,cycle_fraction:config.policy.cycle_grant_fraction_cap_basis_points,
        per_day:config.policy.new_drafts_per_day_cap,per_week:config.policy.new_drafts_per_week_cap};
      await tx`update blog_worker.control set snapshot=${tx.json(snapshot)},heartbeat_at=now() where singleton=true`;
      // A crash during an operator command never silently dispatches it again.
      await tx`update blog_worker.command set state='blocked',result='{"reason":"worker_interrupted"}'::jsonb,finished_at=now()
        where state='running' and started_at<now()-interval '5 minutes'`;
      return (await tx`select definition from blog_worker.source_catalog order by id`).map(r=>r.definition);
    });
  }
  async claimCommand() {
    return this.sql.begin(async tx=>{
      await lock(tx);
      const [command]=await tx`select * from blog_worker.command where state='queued' order by created_at limit 1 for update`;
      if(!command)return null;
      await tx`update blog_worker.command set state='running',started_at=now() where id=${command.id}`;return command;
    });
  }
  async completeCommand(id,result) {
    const blocked=result.generation?.status==='blocked'||result.generation?.status==='held'||result.image?.status==='blocked'||result.image?.status==='held';
    await this.sql`update blog_worker.command set state=${blocked?'blocked':'completed'},result=${this.sql.json(result)},finished_at=now() where id=${id} and state='running'`;
  }
  async summary() {
    const [control]=await this.sql`select paused,reason from blog_worker.control where singleton=true`;
    const candidates=await this.sql`select status,count(*)::int as count from blog_worker.candidate group by status`;
    const [usage]=await this.sql`select coalesce(sum(charged_micro_usd),0)::text as charged_micro_usd,
      coalesce(sum(reserved_micro_usd) filter(where state<>'confirmed'),0)::text as held_micro_usd,
      count(*)::int as attempts from blog_worker.attempt`;
    return {control,candidates,usage};
  }
  async correctImagePrice(record) {
    if(!record || !/^[a-f0-9-]{36}$/.test(record.attempt_id??'')
      || typeof record.verification_reference!=='string' || record.verification_reference.length<8)fail('invalid_price_correction');
    return this.sql.begin(async tx=>{
      const {at}=await lock(tx);
      const [a]=await tx`select * from blog_worker.attempt where id=${record.attempt_id} for update`;
      if(!a || a.kind!=='image' || a.state!=='confirmed' || a.charged_micro_usd===null)fail('price_correction_not_confirmed');
      const price=selectImagePrice([record.price],a.policy,at),cost=imageUsageCost(price,a.usage),previous=n(a.charged_micro_usd);
      if(cost<previous)fail('price_correction_cannot_reduce_charge');
      if(cost===previous && hash(price)===hash(a.price))return {status:'already_corrected',charged_micro_usd:cost};
      const [{actor}]=await tx`select current_user as actor`;
      await tx`insert into blog_worker.operator_event(actor_id,action,target,detail)
        values(${actor},'image_price_corrected',${a.id},${tx.json({previous_price:a.price,previous_charged_micro_usd:previous,
          corrected_price:price,corrected_charged_micro_usd:cost,usage:a.usage,verification_reference:record.verification_reference})})`;
      await tx`update blog_worker.attempt set price=${tx.json(price)},charged_micro_usd=${cost} where id=${a.id}`;
      if(cost>n(a.reserved_micro_usd))await tx`update blog_worker.control set paused=true,reason='usage_exceeded_reservation',updated_at=now() where singleton=true`;
      return {status:'price_corrected',previous_charged_micro_usd:previous,charged_micro_usd:cost};
    });
  }
  async reconcile(record) {
    if(!record || !/^[a-f0-9-]{36}$/.test(record.attempt_id??'') || typeof record.verification_reference!=='string'
      || record.verification_reference.length<8 || !Number.isSafeInteger(record.charged_micro_usd)||record.charged_micro_usd<0)fail('invalid_reconciliation');
    return this.sql.begin(async tx=>{
      await lock(tx);
      const [a]=await tx`select * from blog_worker.attempt where id=${record.attempt_id} for update`;
      if(!a || a.state!=='unknown')fail('reconciliation_not_pending');
      const google=a.provider==='google_subscription';
      if(google&&record.charged_micro_usd!==0)fail('invalid_reconciliation');
      const quota=google?subscriptionUsage(record.usage):null;
      await tx`update blog_worker.attempt set state='confirmed',charged_micro_usd=${record.charged_micro_usd},
        quota_used=${quota},usage=${tx.json({...(google?record.usage:{}),reconciliation_reference:record.verification_reference})},reason='manually_reconciled',finished_at=now() where id=${a.id}`;
      if(google&&quota>n(a.quota_reserved))await tx`update blog_worker.control set paused=true,reason='usage_exceeded_reservation',updated_at=now() where singleton=true`;
      // Reconciliation never retries, imports a draft or clears the circuit automatically.
      return {status:'reconciled',paused:true};
    });
  }
  async resume() {
    return this.sql.begin(async tx=>{
      await lock(tx);
      const [pending]=await tx`select id from blog_worker.attempt where state in ('reserved','unknown') limit 1`;
      if(pending)fail('request_pending');
      const [exceeded]=await tx`select id from blog_worker.attempt where charged_micro_usd>reserved_micro_usd or quota_used>quota_reserved limit 1`;
      if(exceeded)fail('usage_exceeded_reservation');
      await tx`update blog_worker.control set paused=false,reason=null,updated_at=now() where singleton=true`;
      return {status:'circuit_cleared_generation_still_subject_to_policy'};
    });
  }
}
async function holdAfterCharge(tx,id,cost){
  await tx`update blog_worker.candidate set status='held',reason='evidence_changed' where id=${id}`;
  return {status:'held',reason:'evidence_changed',charged_micro_usd:cost};
}

async function subscriptionBudget(tx,policy,at) {
  const [record]=await tx`select attestation from blog_worker.subscription where singleton=true`;
  validateSubscription(record?.attestation,at,policy.google_account_email);
  const {day,week}=periodKeys(at);
  const [q]=await tx`select count(*) filter(where day=${day}::date)::int as day_calls,count(*) filter(where week=${week}::date)::int as week_calls,
    coalesce(sum(coalesce(quota_used,quota_reserved)) filter(where day=${day}::date),0) as day_tokens,
    coalesce(sum(coalesce(quota_used,quota_reserved)) filter(where week=${week}::date),0) as week_tokens from (
      select day,week,quota_used,quota_reserved from blog_worker.attempt where provider='google_subscription'
      union all select (created_at at time zone 'America/Sao_Paulo')::date,date_trunc('week',created_at at time zone 'America/Sao_Paulo')::date,
        (detail->>'quota_used')::bigint,0::bigint from blog_worker.operator_event where action='google_diagnostic_usage'
    ) q`;
  if(q.day_calls>=policy.google_daily_calls_cap || q.week_calls>=policy.google_weekly_calls_cap)fail('google_call_limit');
  if(n(q.day_tokens)+policy.google_tokens_reserved_per_call>policy.google_daily_tokens_cap || n(q.week_tokens)+policy.google_tokens_reserved_per_call>policy.google_weekly_tokens_cap)fail('google_token_limit');
}
