-- One USD 50 calendar-month ledger, shared by both Radar workloads. No activation.
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table radar_ai.operation add column stream text not null default 'radar' check(stream in ('radar','jobs','reserve'));
alter table radar_ai.operation add column purpose text not null default 'normal' check(purpose in ('normal','recheck','recovery'));
alter table radar_ai.operation add constraint reserve_purpose check(stream<>'reserve' or purpose in ('recheck','recovery'));
alter table radar_ai.task add column stream text not null default 'radar' check(stream in ('radar','jobs','reserve'));
alter table radar_ai.task add column purpose text not null default 'normal' check(purpose in ('normal','recheck','recovery'));

-- An operator must reconcile all pre-existing API consumers before opening a month.
create table radar_ai.month_opening (
 period date primary key check(extract(day from period)=1),
 reference text not null unique check(length(reference) between 8 and 500),
 verified_at timestamptz not null default now()
);
create table radar_ai.prior_usage (
 id uuid primary key default gen_random_uuid(), period date not null references radar_ai.month_opening(period),
 stream text not null check(stream in ('radar','jobs','reserve')),
 amount_micro bigint not null check(amount_micro>=0), reference text unique not null check(length(reference) between 8 and 500)
);

create function radar_ai.shared_usage() returns jsonb language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
 with bounds as (select date_trunc('month',now() at time zone 'America/Sao_Paulo')::date as period),
 amounts as (
  select o.stream,case when o.state in ('reserved','sent','unknown') then 0 else o.actual_micro end as spent,
   case when o.state in ('reserved','sent','unknown') then o.maximum_micro else 0 end as held
  from radar_ai.operation o cross join bounds b
  where date_trunc('month',o.created_at at time zone 'America/Sao_Paulo')::date=b.period or o.state in ('reserved','sent','unknown')
  union all select u.stream,u.amount_micro,0 from radar_ai.prior_usage u join bounds b on b.period=u.period
 ), lanes as (select v.stream,v.cap,coalesce(sum(a.spent),0)::bigint spent,coalesce(sum(a.held),0)::bigint held
  from (values('radar',30000000::bigint),('jobs',15000000::bigint),('reserve',5000000::bigint)) v(stream,cap)
  left join amounts a on a.stream=v.stream group by v.stream,v.cap)
 select jsonb_build_object('period',(select period from bounds),'opening_verified',exists(select 1 from radar_ai.month_opening where period=(select period from bounds) and verified_at<=now()),'cap_micro',50000000,
  'spent_micro',sum(spent),'reserved_micro',sum(held),'available_micro',greatest(0,50000000-sum(spent+held)),
  'committed_micro',sum(spent+held),'warning_percent',case when sum(spent+held)>=45000000 then 90 when sum(spent+held)>=40000000 then 80 else 0 end,
  'streams',jsonb_object_agg(stream,jsonb_build_object('cap_micro',cap,'spent_micro',spent,'reserved_micro',held,
    'committed_micro',spent+held,'available_micro',greatest(0,cap-spent-held)))) from lanes
$$;

-- Keep the existing credit, account, tariff and task-lease checks intact.
alter function radar_ai.block_reason() rename to legacy_block_reason;
create function radar_ai.block_reason() returns text language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
 select coalesce(radar_ai.legacy_block_reason(),case
  when not exists(select 1 from radar_ai.month_opening where period=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date and verified_at<=now()) then 'monthly_usage_unverified'
  when not exists(select 1 from radar_ai.cycle g join radar_ai.control c on c.cycle_id=g.id
    where g.starts_at=(date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
      and g.ends_at=((date_trunc('month',now() at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo')) then 'calendar_month_unverified'
  else null end)
$$;

-- Retain bounded per-operation/daily limits; replace the former USD 40 envelope split.
do $replace$
declare definition text;
begin
 select pg_get_functiondef('radar_ai.reserve(text,text,text,text,bigint,integer)'::regprocedure) into definition;
 definition:=replace(definition,'least(40000000,','least(50000000,');
 definition:=replace(definition,
  'case e when ''extraction'' then 20000000 when ''discovery'' then 8000000 when ''search'' then 6000000 when ''embeddings'' then 1000000 when ''evaluation'' then 5000000 else null end',
  'case when e in (''extraction'',''discovery'',''search'',''embeddings'',''evaluation'') then 50000000 else null end');
 execute definition;
 select pg_get_functiondef('radar_ai.mark_sent(uuid)'::regprocedure) into definition;
 execute replace(definition,'least(40000000,','least(50000000,');
end $replace$;
alter function radar_ai.reserve(text,text,text,text,bigint,integer) rename to legacy_reserve;
create function radar_ai.reserve(k text,e text,h text,m text,i bigint,o integer,s text default 'radar',p text default 'normal') returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare usage jsonb; result jsonb; prior radar_ai.operation; estimate bigint; tariff radar_ai.price; why text;
begin
 perform 1 from radar_ai.control where singleton for update;
 if not found then return jsonb_build_object('status','blocked','reason','control_unavailable'); end if;
 if s is null or s not in ('radar','jobs','reserve') or p is null or p not in ('normal','recheck','recovery') or
  (s='reserve' and p='normal') then return jsonb_build_object('status','blocked','reason','invalid_budget_stream'); end if;
 select * into prior from radar_ai.operation where operation_key=k;
 if found then return jsonb_build_object('status','duplicate','id',prior.id,'reason',case when prior.stream=s and prior.purpose=p
  and prior.request_hash=h and prior.envelope=e and prior.model=m then 'already_recorded' else 'identity_conflict' end); end if;
 why:=radar_ai.block_reason();
 if why is not null then return jsonb_build_object('status','blocked','reason',why); end if;
 select * into tariff from radar_ai.price where model=m and approved and valid_until>now();
 if not found then return jsonb_build_object('status','blocked','reason','price_unverified'); end if;
 estimate:=ceil(i::numeric*tariff.input_micro_per_million/1000000)+ceil(o::numeric*tariff.output_micro_per_million/1000000)+tariff.fixed_micro;
 usage:=radar_ai.shared_usage();
 if (usage->>'committed_micro')::numeric+estimate>50000000 then return jsonb_build_object('status','blocked','reason','monthly_limit'); end if;
 if (usage->'streams'->s->>'committed_micro')::numeric+estimate>(usage->'streams'->s->>'cap_micro')::numeric
  then return jsonb_build_object('status','blocked','reason','stream_limit'); end if;
 result:=radar_ai.legacy_reserve(k,e,h,m,i,o);
 if result->>'status'='reserved' then update radar_ai.operation set stream=s,purpose=p where id=(result->>'id')::uuid; end if;
 return result;
end $$;

alter function radar_ai.mark_sent(uuid) rename to legacy_mark_sent;
create function radar_ai.mark_sent(operation_id uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare usage jsonb; op radar_ai.operation; why text;
begin
 perform 1 from radar_ai.control where singleton for update;
 select * into op from radar_ai.operation where id=operation_id for update;
 if not found or op.state<>'reserved' then return jsonb_build_object('sent',false,'reason','already_recorded'); end if;
 usage:=radar_ai.shared_usage();
 if (usage->>'committed_micro')::numeric>50000000 then why:='monthly_limit';
 elsif (usage->'streams'->op.stream->>'committed_micro')::numeric>(usage->'streams'->op.stream->>'cap_micro')::numeric then why:='stream_limit'; end if;
 if why is not null then
  update radar_ai.operation set state='not_sent',actual_micro=0,finished_at=now(),reason=why where id=operation_id;
  return jsonb_build_object('sent',false,'reason',why);
 end if;
 return radar_ai.legacy_mark_sent(operation_id);
end $$;

alter function radar_ai.enqueue(text,text,text,text,text,jsonb,timestamptz) rename to legacy_enqueue;
create function radar_ai.enqueue(k text,s text,r text,h text,e text,b jsonb,expiry timestamptz,lane text default 'radar',why text default 'normal') returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare result jsonb;
begin
 if current_setting('app.is_admin',true) is distinct from 'true' then raise exception 'administrative_context_required'; end if;
 if lane is null or lane not in ('radar','jobs','reserve') or why is null or why not in ('normal','recheck','recovery') or
  (lane='reserve' and why='normal') then raise exception 'invalid_budget_stream'; end if;
 result:=radar_ai.legacy_enqueue(k,s,r,h,e,b,expiry);
 if result->>'status'='queued' then update radar_ai.task set stream=lane,purpose=why where id=(result->>'id')::uuid;
 elsif exists(select 1 from radar_ai.task where id=(result->>'id')::uuid and (stream<>lane or purpose<>why)) then
  return jsonb_build_object('status','duplicate','id',result->>'id','matches',false);
 end if;
 return result;
end $$;

-- Task attachment cannot move a request into another allocation after hashing.
do $attach$
declare definition text;
begin
 select pg_get_functiondef('radar_ai.attach_task(uuid,uuid,uuid)'::regprocedure) into definition;
 execute replace(definition,'and o.envelope=t.envelope','and o.envelope=t.envelope and o.stream=t.stream and o.purpose=t.purpose');
end $attach$;
alter function radar_ai.status() rename to legacy_status;
create function radar_ai.status() returns jsonb language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
 select radar_ai.legacy_status() || jsonb_build_object('monthly',radar_ai.shared_usage(),'budget_block',radar_ai.block_reason())
$$;

do $permissions$ declare item record;
begin
 for item in select tablename from pg_tables where schemaname='radar_ai' and tablename in ('month_opening','prior_usage') loop
  execute format('alter table radar_ai.%I owner to radar_ai_owner',item.tablename);
  execute format('revoke all on table radar_ai.%I from public,radar_ai_worker,radar_reader,radar_editor',item.tablename);
 end loop;
 for item in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='radar_ai' loop
  execute format('alter function %s owner to radar_ai_owner',item.signature);
  execute format('revoke all on function %s from public',item.signature);
  if item.signature::text like '%legacy_%' then execute format('revoke all on function %s from radar_ai_worker,radar_reader,radar_editor',item.signature); end if;
 end loop;
end $permissions$;
grant execute on function radar_ai.status(),radar_ai.reserve(text,text,text,text,bigint,integer,text,text),radar_ai.mark_sent(uuid) to radar_ai_worker;
grant execute on function radar_ai.enqueue(text,text,text,text,text,jsonb,timestamptz,text,text) to radar_editor;
grant execute on function radar_ai.status() to radar_editor;
