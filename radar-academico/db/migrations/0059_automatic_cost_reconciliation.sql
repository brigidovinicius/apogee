-- Separate read-cost process. No key, grant, price, month opening or activation is seeded.
set local lock_timeout='5s';
set local statement_timeout='60s';
do $$ begin
 if not exists(select 1 from pg_roles where rolname='radar_ai_reconciler') then
  create role radar_ai_reconciler nologin nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication;
 end if;
 if exists(select 1 from pg_roles where rolname='radar_ai_reconciler' and
   (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolinherit or rolreplication)) or
   exists(select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='radar_ai_reconciler')) then
  raise exception 'Unsafe reconciliation role';
 end if;
end $$;
grant usage on schema radar_ai to radar_ai_reconciler;
do $db$ begin execute format('grant connect on database %I to radar_ai_reconciler',current_database()); end $db$;
create table radar_ai.reconciliation_anchor (
 cycle_id text primary key references radar_ai.cycle(id), period date not null,
 free_grant_micro bigint not null check(free_grant_micro>0), grant_until timestamptz not null,
 provider_baseline_micro bigint not null check(provider_baseline_micro>=0),
 radar_baseline_micro bigint not null check(radar_baseline_micro>=0),
 last_provider_micro bigint not null check(last_provider_micro>=provider_baseline_micro),
 reference text not null check(length(reference) between 8 and 500),
 verified_at timestamptz not null default now(), last_verified_at timestamptz,
 auto_reload_off boolean not null check(auto_reload_off),
 tariff jsonb not null, last_reference text
);
alter table radar_ai.reconciliation_anchor owner to radar_ai_owner;
revoke all on radar_ai.reconciliation_anchor from public,radar_reader,radar_editor,radar_ai_worker,radar_ai_reconciler;

create function radar_ai.reconciliation_config() returns jsonb language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
 select jsonb_build_object('organizationId',c.organization_id,'period',a.period,'grantUntil',a.grant_until,
  'startTime',extract(epoch from g.starts_at)::bigint,'endTime',extract(epoch from g.ends_at)::bigint,
  'model','gpt-6-luna','tariff',a.tariff)
 from radar_ai.control c join radar_ai.cycle g on g.id=c.cycle_id join radar_ai.reconciliation_anchor a on a.cycle_id=g.id
 where c.singleton and c.enabled and not c.manual_paused and a.auto_reload_off and a.grant_until>now()
  and g.starts_at<=now() and g.ends_at>now() and g.organization_id=c.organization_id and g.project_id=c.project_id
  and a.period=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date
$$;

create function radar_ai.refresh_reconciliation(provider_micro bigint, observed timestamptz, reference text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare c radar_ai.control; a radar_ai.reconciliation_anchor; g radar_ai.cycle; usage jsonb;
 remaining bigint; ceiling_micro bigint; expiry timestamptz;
begin
 select * into c from radar_ai.control where singleton for update;
 if not found or not c.enabled or c.manual_paused then return jsonb_build_object('updated',false,'reason','operator_control'); end if;
 select * into a from radar_ai.reconciliation_anchor where cycle_id=c.cycle_id for update;
 select * into g from radar_ai.cycle where id=c.cycle_id;
 if a.cycle_id is null or not a.auto_reload_off or a.grant_until<=now() or g.starts_at>now() or g.ends_at<=now() or
  g.organization_id is distinct from c.organization_id or g.project_id is distinct from c.project_id or
  not exists(select 1 from radar_ai.attestation where cycle_id=c.cycle_id and free_only_verified) or
  a.period<>date_trunc('month',now() at time zone 'America/Sao_Paulo')::date then
  return jsonb_build_object('updated',false,'reason','anchor_unavailable'); end if;
 if provider_micro is null or provider_micro<a.last_provider_micro or provider_micro>1000000000000 or
  observed is null or observed<now()-interval '5 minutes' or observed>now()+interval '1 minute' or
  reference is null or length(reference) not between 8 and 500 then raise exception 'Invalid provider evidence'; end if;
 if not exists(select 1 from radar_ai.response_tariff r join radar_ai.price p on p.model=r.model and p.version=r.price_version
  where p.model='gpt-6-luna' and p.approved and r.approved and
   jsonb_build_object('input',r.input_micro_per_million,'cached',r.cached_input_micro_per_million,
     'write',r.cache_write_micro_per_million,'output',r.output_micro_per_million)=a.tariff and
   p.input_micro_per_million=greatest(r.input_micro_per_million,r.cached_input_micro_per_million,r.cache_write_micro_per_million)
   and p.output_micro_per_million=r.output_micro_per_million and p.fixed_micro=0) then
  return jsonb_build_object('updated',false,'reason','price_changed'); end if;
 usage:=radar_ai.shared_usage();
 if not coalesce((usage->>'opening_verified')::boolean,false) then return jsonb_build_object('updated',false,'reason','monthly_usage_unverified'); end if;
 -- Never assume missing/lagged provider usage is free. Include all local commitments.
 remaining:=greatest(0,a.free_grant_micro-greatest(provider_micro-a.provider_baseline_micro,
   (usage->>'committed_micro')::bigint-a.radar_baseline_micro,0));
 ceiling_micro:=case when remaining=0 then 0 else least(50000000,(usage->>'committed_micro')::bigint+remaining) end;
 expiry:=least(now()+interval '2 hours',a.grant_until,g.ends_at);
 update radar_ai.attestation set verified_at=now(),proof_until=expiry,free_micro=ceiling_micro,
  free_only_verified=true,reference=refresh_reconciliation.reference where cycle_id=c.cycle_id;
 update radar_ai.price set valid_until=expiry where model='gpt-6-luna' and approved;
 update radar_ai.response_tariff set valid_until=expiry where model='gpt-6-luna' and approved;
 update radar_ai.reconciliation_anchor set last_provider_micro=provider_micro,last_verified_at=now(),
   last_reference=refresh_reconciliation.reference where cycle_id=c.cycle_id;
 return jsonb_build_object('updated',true,'proofUntil',expiry,'freeRemainingMicro',remaining,'capMicro',50000000);
end $$;
alter function radar_ai.reconciliation_config() owner to radar_ai_owner;
alter function radar_ai.refresh_reconciliation(bigint,timestamptz,text) owner to radar_ai_owner;
revoke all on function radar_ai.reconciliation_config(),radar_ai.refresh_reconciliation(bigint,timestamptz,text)
 from public,radar_reader,radar_editor,radar_ai_worker;
grant execute on function radar_ai.reconciliation_config(),radar_ai.refresh_reconciliation(bigint,timestamptz,text) to radar_ai_reconciler;
