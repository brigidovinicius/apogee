-- Opt-in rollover of an existing verified grant, never a new credit allocation.
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table radar_ai.reconciliation_anchor
 add column origin_cycle_id text references radar_ai.reconciliation_anchor(cycle_id),
 add column automatic_months boolean not null default false,
 add column last_month_provider_micro bigint not null default 0 check(last_month_provider_micro>=0);

create function radar_ai.month_bounds(at_time timestamptz)
returns table(period date,starts_at timestamptz,ends_at timestamptz)
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select date_trunc('month',at_time at time zone 'America/Sao_Paulo')::date,
 date_trunc('month',at_time at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo',
 (date_trunc('month',at_time at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo'
$$;

create or replace function radar_ai.reconciliation_config() returns jsonb language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
 select jsonb_build_object('organizationId',c.organization_id,'period',b.period,'cycleId',c.cycle_id,
  'grantUntil',r.grant_until,'startTime',extract(epoch from origin.starts_at)::bigint,
  'monthStartTime',extract(epoch from b.starts_at)::bigint,'endTime',extract(epoch from b.ends_at)::bigint,
  'model','gpt-6-luna','tariff',r.tariff)
 from radar_ai.control c join radar_ai.cycle g on g.id=c.cycle_id
 join radar_ai.reconciliation_anchor a on a.cycle_id=g.id
 join radar_ai.reconciliation_anchor r on r.cycle_id=coalesce(a.origin_cycle_id,a.cycle_id)
 join radar_ai.cycle origin on origin.id=r.cycle_id cross join radar_ai.month_bounds(now()) b
 where c.singleton and c.enabled and not c.manual_paused and r.auto_reload_off and a.auto_reload_off
  and r.grant_until>now() and a.grant_until>now()
  and g.starts_at<=now() and origin.starts_at<=g.starts_at and g.cap_micro=50000000
  and g.organization_id=c.organization_id and g.project_id=c.project_id
  and origin.organization_id=c.organization_id and origin.project_id=c.project_id
  and (a.period=b.period or (r.automatic_months and a.period<b.period))
$$;

create function radar_ai.reconcile_calendar_month(expected_cycle text,expected_period date,
 provider_micro bigint,month_micro bigint,observed timestamptz,evidence_reference text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare c radar_ai.control; a radar_ai.reconciliation_anchor; r radar_ai.reconciliation_anchor;
 g radar_ai.cycle; origin radar_ai.cycle; bounds record; rollover boolean; target text; import_ref text;
 known bigint; imported bigint; gap bigint; existing_gap bigint; local_total bigint; cycle_used bigint;
 remaining bigint; ceiling_micro bigint; expiry timestamptz;
begin
 select * into c from radar_ai.control where singleton for update;
 if not found or not c.enabled or c.manual_paused then return jsonb_build_object('updated',false,'reason','operator_control'); end if;
 select * into bounds from radar_ai.month_bounds(now());
 if expected_cycle is distinct from c.cycle_id or expected_period is distinct from bounds.period then
  return jsonb_build_object('updated',false,'reason','configuration_changed'); end if;
 select * into a from radar_ai.reconciliation_anchor where cycle_id=c.cycle_id for update;
 select * into r from radar_ai.reconciliation_anchor where cycle_id=coalesce(a.origin_cycle_id,a.cycle_id) for update;
 select * into g from radar_ai.cycle where id=c.cycle_id;
 select * into origin from radar_ai.cycle where id=r.cycle_id;
 if a.cycle_id is null or r.cycle_id is null or not r.auto_reload_off or not a.auto_reload_off or
  r.grant_until<=now() or a.grant_until<=now() or
  g.starts_at>now() or origin.starts_at>g.starts_at or g.cap_micro<>50000000 or
  g.organization_id is distinct from c.organization_id or g.project_id is distinct from c.project_id or
  origin.organization_id is distinct from c.organization_id or origin.project_id is distinct from c.project_id or
  not exists(select 1 from radar_ai.attestation where cycle_id=c.cycle_id and free_only_verified) or
  not exists(select 1 from radar_ai.attestation where cycle_id=r.cycle_id and free_only_verified) or a.period>bounds.period or
  g.starts_at is distinct from (select starts_at from radar_ai.month_bounds(g.starts_at)) or
  g.ends_at is distinct from (select ends_at from radar_ai.month_bounds(g.starts_at)) or
  a.period is distinct from (select period from radar_ai.month_bounds(g.starts_at)) then
  return jsonb_build_object('updated',false,'reason','anchor_unavailable'); end if;
 rollover:=a.period<bounds.period;
 if rollover and not r.automatic_months then return jsonb_build_object('updated',false,'reason','rollover_disabled'); end if;
 if provider_micro is null or provider_micro<greatest(r.last_provider_micro,a.last_provider_micro) or
  provider_micro>1000000000000 or month_micro is null or month_micro<0 or month_micro>provider_micro or
  (not rollover and month_micro<a.last_month_provider_micro) or observed is null or
  observed<now()-interval '5 minutes' or observed>now()+interval '1 minute' or evidence_reference is null or
  length(evidence_reference) not between 8 and 500 then raise exception 'Invalid provider evidence'; end if;
 if not exists(select 1 from radar_ai.response_tariff t join radar_ai.price p on p.model=t.model and p.version=t.price_version
  where p.model='gpt-6-luna' and p.approved and t.approved and
   jsonb_build_object('input',t.input_micro_per_million,'cached',t.cached_input_micro_per_million,
    'write',t.cache_write_micro_per_million,'output',t.output_micro_per_million)=r.tariff and
   p.input_micro_per_million=greatest(t.input_micro_per_million,t.cached_input_micro_per_million,t.cache_write_micro_per_million)
   and p.output_micro_per_million=t.output_micro_per_million and p.fixed_micro=0) then
  return jsonb_build_object('updated',false,'reason','price_changed'); end if;
 if rollover and exists(select 1 from radar_ai.month_opening where period=bounds.period) then
  return jsonb_build_object('updated',false,'reason','monthly_opening_conflict'); end if;
 if not rollover and (g.starts_at<>bounds.starts_at or g.ends_at<>bounds.ends_at or
  not exists(select 1 from radar_ai.month_opening where period=bounds.period and verified_at<=now())) then
  return jsonb_build_object('updated',false,'reason','monthly_usage_unverified'); end if;

 import_ref:='auto-costs:'||r.cycle_id||':'||bounds.period::text;
 -- Only fully settled requests entirely inside this BRT month can offset
 -- provider usage. UTC-day boundary overlap and uncertain requests stay charged.
 select coalesce(sum(actual_micro),0) into known from radar_ai.operation where state='confirmed'
  and created_at>=bounds.starts_at and sent_at>=bounds.starts_at and finished_at>=bounds.starts_at
  and created_at<bounds.ends_at and sent_at<bounds.ends_at and finished_at<=observed;
 select coalesce(sum(amount_micro) filter(where reference<>import_ref),0),
  coalesce(sum(amount_micro) filter(where reference=import_ref),0) into imported,existing_gap
  from radar_ai.prior_usage where period=bounds.period;
 gap:=greatest(existing_gap,month_micro-known-imported,0);
 select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into local_total from radar_ai.operation
  where created_at>=origin.starts_at or state in ('reserved','sent','unknown');
 select local_total+coalesce(sum(amount_micro),0)+gap-existing_gap into local_total from radar_ai.prior_usage where period>=r.period;
 remaining:=greatest(0,r.free_grant_micro-greatest(provider_micro-r.provider_baseline_micro,
  local_total-r.radar_baseline_micro,0));
 if rollover and remaining=0 then return jsonb_build_object('updated',false,'reason','credit_exhausted'); end if;
 target:=case when rollover then 'radar-auto-'||to_char(bounds.period,'YYYYMM')||'-'||
  substr(md5(r.cycle_id||':'||c.organization_id||':'||c.project_id),1,16) else c.cycle_id end;
 expiry:=least(now()+interval '2 hours',r.grant_until,bounds.ends_at);
 if rollover then
  insert into radar_ai.cycle values(target,'radar',c.organization_id,c.project_id,bounds.starts_at,bounds.ends_at,50000000);
  insert into radar_ai.month_opening(period,reference) values(bounds.period,'auto-opening:'||target);
  insert into radar_ai.reconciliation_anchor(cycle_id,period,free_grant_micro,grant_until,provider_baseline_micro,
   radar_baseline_micro,last_provider_micro,reference,auto_reload_off,tariff,origin_cycle_id,automatic_months,last_month_provider_micro)
  values(target,bounds.period,r.free_grant_micro,r.grant_until,r.provider_baseline_micro,r.radar_baseline_micro,
   provider_micro,'carried-grant:'||r.cycle_id,true,r.tariff,r.cycle_id,true,month_micro);
 end if;
 insert into radar_ai.prior_usage(period,stream,amount_micro,reference) values(bounds.period,'radar',gap,import_ref)
  on conflict(reference) do update set amount_micro=greatest(radar_ai.prior_usage.amount_micro,excluded.amount_micro);
 -- The legacy send gate compares cycle operations, not imported provider costs.
 -- Its ceiling must be operations already committed plus remaining credit.
 select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into cycle_used from radar_ai.operation
  where cycle_id=target or state in ('reserved','sent','unknown');
 ceiling_micro:=case when remaining=0 then 0 else least(50000000,cycle_used+remaining) end;
 insert into radar_ai.attestation values(target,ceiling_micro,now(),expiry,true,evidence_reference)
  on conflict(cycle_id) do update set free_micro=excluded.free_micro,verified_at=excluded.verified_at,
   proof_until=excluded.proof_until,free_only_verified=true,reference=excluded.reference;
 update radar_ai.control set cycle_id=target where singleton;
 update radar_ai.price set valid_until=expiry where model='gpt-6-luna' and approved;
 update radar_ai.response_tariff set valid_until=expiry where model='gpt-6-luna' and approved;
 update radar_ai.reconciliation_anchor set last_provider_micro=provider_micro,last_verified_at=now(),last_reference=evidence_reference
  where cycle_id in (r.cycle_id,target);
 update radar_ai.reconciliation_anchor set last_month_provider_micro=month_micro where cycle_id=target;
 return jsonb_build_object('updated',true,'rolledOver',rollover,'proofUntil',expiry,
  'freeRemainingMicro',remaining,'capMicro',50000000,'period',bounds.period);
end $$;
alter function radar_ai.month_bounds(timestamptz) owner to radar_ai_owner;
alter function radar_ai.reconcile_calendar_month(text,date,bigint,bigint,timestamptz,text) owner to radar_ai_owner;
revoke all on function radar_ai.month_bounds(timestamptz),
 radar_ai.reconcile_calendar_month(text,date,bigint,bigint,timestamptz,text)
 from public,radar_reader,radar_editor,radar_ai_worker,radar_ai_reconciler;
grant execute on function radar_ai.reconcile_calendar_month(text,date,bigint,bigint,timestamptz,text) to radar_ai_reconciler;
