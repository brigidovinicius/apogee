-- Local candidate only. Production migration is a separate operator action.
set local lock_timeout = '5s';
set local statement_timeout = '60s';
do $roles$
declare n text;
begin
  foreach n in array array['radar_ai_owner','radar_ai_worker'] loop
    if not exists(select 1 from pg_roles where rolname=n) then
      execute format('create role %I nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication',n);
    end if;
    if exists(select 1 from pg_roles r where rolname=n and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit or exists(select 1 from pg_auth_members where member=r.oid))) then
      raise exception 'Unsafe AI role: %',n;
    end if;
  end loop;
end $roles$;
alter role radar_ai_owner nologin;
alter role radar_ai_worker login;
create schema radar_ai authorization radar_ai_owner;
revoke all on schema radar_ai from public,radar_reader,radar_editor;
grant usage on schema radar_ai to radar_ai_worker;
do $db$ begin execute format('grant connect on database %I to radar_ai_worker',current_database()); end $db$;

create table radar_ai.cycle (
  id text primary key check(length(id) between 1 and 100), product text not null check(product='radar'),
  organization_id text not null, project_id text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  cap_micro bigint not null check(cap_micro between 0 and 50000000), check(ends_at>starts_at)
);
create table radar_ai.attestation (
  cycle_id text primary key references radar_ai.cycle(id), free_micro bigint not null check(free_micro>=0),
  verified_at timestamptz not null, proof_until timestamptz not null, free_only_verified boolean not null default false,
  reference text not null check(length(reference) between 8 and 500),
  check(proof_until>verified_at and proof_until<=verified_at+interval '6 hours')
);
create table radar_ai.control (
  singleton boolean primary key default true check(singleton), enabled boolean not null default false,
  manual_paused boolean not null default false, cycle_id text references radar_ai.cycle(id),
  organization_id text, project_id text, circuit_until timestamptz, circuit_reason text
);
insert into radar_ai.control(singleton) values(true);
create table radar_ai.price (
  model text primary key, version text not null, approved boolean not null default false,
  valid_until timestamptz not null, input_micro_per_million bigint not null check(input_micro_per_million>=0),
  output_micro_per_million bigint not null check(output_micro_per_million>=0),
  fixed_micro bigint not null default 0 check(fixed_micro>=0)
);
create table radar_ai.operation (
  id uuid primary key default gen_random_uuid(), operation_key text unique not null,
  cycle_id text not null references radar_ai.cycle(id), envelope text not null,
  request_hash text not null, model text not null, price_snapshot jsonb not null,
  maximum_micro bigint not null check(maximum_micro>0), actual_micro bigint check(actual_micro>=0),
  state text not null check(state in ('reserved','sent','confirmed','not_sent','unknown')),
  created_at timestamptz not null default now(), sent_at timestamptz, finished_at timestamptz, reason text,
  check((state in ('confirmed','not_sent'))=(actual_micro is not null)),
  check(state<>'not_sent' or actual_micro=0)
);
create index radar_ai_operation_cycle on radar_ai.operation(cycle_id,created_at);

create function radar_ai.status() returns jsonb language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
  select jsonb_build_object('enabled',c.enabled,'manual_paused',c.manual_paused,'cycle_id',g.id,'product',g.product,
    'project_matches',coalesce(g.project_id=c.project_id and g.organization_id=c.organization_id,false),
    'starts_at',g.starts_at,'ends_at',g.ends_at,'free_micro',a.free_micro,'verified_at',a.verified_at,
    'proof_until',a.proof_until,'free_only_verified',a.free_only_verified,'circuit_until',c.circuit_until,'circuit_reason',c.circuit_reason)
  from radar_ai.control c left join radar_ai.cycle g on g.id=c.cycle_id left join radar_ai.attestation a on a.cycle_id=g.id where c.singleton
$$;

-- Both reserve and mark_sent recheck the entitlement under one control-row lock.
create function radar_ai.block_reason() returns text language sql stable security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
  select case when c.manual_paused then 'operator_pause' when not c.enabled then 'disabled'
    when g.id is null or g.product<>'radar' or c.project_id is distinct from g.project_id or c.organization_id is distinct from g.organization_id then 'allocation_unverified'
    when g.starts_at>now() then 'allocation_unverified' when g.ends_at<=now() then 'credit_expired'
    when a.cycle_id is null or a.verified_at>now() or a.proof_until<=now() or not a.free_only_verified then 'billing_unverified'
    when a.free_micro<=0 then 'credit_exhausted' when c.circuit_until>now() then coalesce(c.circuit_reason,'api_unavailable') else null end
  from radar_ai.control c left join radar_ai.cycle g on g.id=c.cycle_id left join radar_ai.attestation a on a.cycle_id=g.id where c.singleton
$$;

create function radar_ai.reserve(k text,e text,h text,m text,i bigint,o integer) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare c radar_ai.control; g radar_ai.cycle; a radar_ai.attestation; p radar_ai.price; prior radar_ai.operation;
  why text; cost bigint; cycle_used bigint; day_used bigint; envelope_used bigint; older_holds bigint; envelope_cap bigint; result_id uuid;
begin
  select * into c from radar_ai.control where singleton for update;
  if not found then return jsonb_build_object('status','blocked','reason','control_unavailable'); end if;
  if k is null or k!~'^[a-zA-Z0-9:_-]{8,160}$' or h is null or h!~'^[a-f0-9]{64}$' or i is null or i<1 or i>64000 or o is null or o<1 or o>8000 then
    return jsonb_build_object('status','blocked','reason','invalid_operation'); end if;
  select * into prior from radar_ai.operation where operation_key=k;
  if found then return jsonb_build_object('status','duplicate','reason',case when prior.request_hash=h and prior.envelope=e and prior.model=m then 'already_recorded' else 'identity_conflict' end,'id',prior.id); end if;
  why:=radar_ai.block_reason();
  if why is not null then return jsonb_build_object('status','blocked','reason',why); end if;
  select * into g from radar_ai.cycle where id=c.cycle_id;
  select * into a from radar_ai.attestation where cycle_id=g.id;
  select * into p from radar_ai.price where model=m and approved and valid_until>now();
  if not found then return jsonb_build_object('status','blocked','reason','price_unverified'); end if;
  envelope_cap:=case e when 'extraction' then 20000000 when 'discovery' then 8000000 when 'search' then 6000000 when 'embeddings' then 1000000 when 'evaluation' then 5000000 else null end;
  if envelope_cap is null then return jsonb_build_object('status','blocked','reason','invalid_envelope'); end if;
  cost:=ceil(i::numeric*p.input_micro_per_million/1000000)+ceil(o::numeric*p.output_micro_per_million/1000000)+p.fixed_micro;
  if cost<=0 or cost>2000000 then return jsonb_build_object('status','blocked','reason','operation_limit'); end if;
  select coalesce(sum(coalesce(actual_micro,maximum_micro)) filter(where cycle_id=g.id),0),
    coalesce(sum(coalesce(actual_micro,maximum_micro)) filter(where (coalesce(sent_at,created_at) at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date),0),
    coalesce(sum(coalesce(actual_micro,maximum_micro)) filter(where cycle_id=g.id and envelope=e),0),
    coalesce(sum(maximum_micro) filter(where cycle_id<>g.id and state in ('reserved','sent','unknown')),0)
    into cycle_used,day_used,envelope_used,older_holds from radar_ai.operation;
  -- free_micro is the operator-attested allocation ceiling, not a second mutable wallet.
  if cycle_used+older_holds+cost>least(40000000,g.cap_micro,a.free_micro) then why:='cycle_limit';
  elsif day_used+cost>2000000 then why:='daily_limit';
  elsif envelope_used+cost>envelope_cap then why:='envelope_limit'; end if;
  if why is not null then return jsonb_build_object('status','blocked','reason',why,'mode','BASE_CREDITO'); end if;
  insert into radar_ai.operation(operation_key,cycle_id,envelope,request_hash,model,price_snapshot,maximum_micro,state)
    values(k,g.id,e,h,m,to_jsonb(p),cost,'reserved') returning id into result_id;
  return jsonb_build_object('status','reserved','id',result_id,'maximum_micro',cost);
end $$;

create function radar_ai.mark_sent(operation_id uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare r radar_ai.operation; why text; c radar_ai.control; cap bigint; committed bigint; today bigint;
begin
  select * into c from radar_ai.control where singleton for update;
  if not found then return jsonb_build_object('sent',false,'reason','control_unavailable'); end if;
  select * into r from radar_ai.operation where id=operation_id for update;
  if not found or r.state<>'reserved' then return jsonb_build_object('sent',false,'reason','already_recorded'); end if;
  why:=radar_ai.block_reason();
  if r.cycle_id is distinct from c.cycle_id then why:='cycle_changed'; end if;
  if r.created_at<now()-interval '3 minutes' then why:='reservation_expired'; end if;
  if not exists(select 1 from radar_ai.price p where p.model=r.model and p.approved and p.valid_until>now() and to_jsonb(p)=r.price_snapshot) then why:='price_changed'; end if;
  select least(40000000,g.cap_micro,a.free_micro) into cap from radar_ai.cycle g join radar_ai.attestation a on a.cycle_id=g.id where g.id=c.cycle_id;
  select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into committed from radar_ai.operation
    where cycle_id=c.cycle_id or state in ('reserved','sent','unknown');
  if committed>cap then why:='cycle_limit'; end if;
  select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into today from radar_ai.operation
    where id<>r.id and (coalesce(sent_at,created_at) at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
  if today+r.maximum_micro>2000000 then why:='daily_limit'; end if;
  if exists(select 1 from radar_ai.operation where id<>r.id and state='sent') then why:='worker_busy'; end if;
  if why is not null then
    update radar_ai.operation set state='not_sent',actual_micro=0,finished_at=now(),reason=why where id=operation_id;
    return jsonb_build_object('sent',false,'reason',why);
  end if;
  update radar_ai.operation set state='sent',sent_at=now() where id=operation_id;
  return jsonb_build_object('sent',true);
end $$;

create function radar_ai.finish(operation_id uuid,outcome text,cost bigint,why text) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare r radar_ai.operation; discrepancy boolean;
begin
  perform 1 from radar_ai.control where singleton for update;
  select * into r from radar_ai.operation where id=operation_id for update;
  if not found or r.state not in ('reserved','sent') then return jsonb_build_object('accepted',false,'reason','already_recorded'); end if;
  if outcome is null or outcome not in ('confirmed','not_sent','unknown') or
    (outcome='confirmed' and (r.state<>'sent' or cost is null or cost<0)) or
    (outcome='not_sent' and r.state<>'reserved') then raise exception 'invalid_settlement'; end if;
  -- Only an operator can reconcile an unknown record. A worker cannot release it later.
  if outcome='unknown' then
    update radar_ai.operation set state='unknown',reason=left(coalesce(why,'usage_unknown'),80) where id=operation_id;
    update radar_ai.control set circuit_until=greatest(circuit_until,case when why='credit_balance_exhausted' then
      (select ends_at from radar_ai.cycle where id=r.cycle_id) else now()+interval '5 minutes' end),
      circuit_reason=case when why='credit_balance_exhausted' or (circuit_until>now() and circuit_reason='credit_balance_exhausted')
        then 'credit_balance_exhausted' else 'api_unavailable' end where singleton;
    return jsonb_build_object('accepted',false,'reason','usage_unknown');
  end if;
  discrepancy:=outcome='confirmed' and cost>r.maximum_micro;
  update radar_ai.operation set state=outcome,actual_micro=case when outcome='not_sent' then 0 else cost end,
    finished_at=now(),reason=case when discrepancy then 'usage_exceeded_reservation' else left(why,80) end where id=operation_id;
  if discrepancy then
    update radar_ai.control set manual_paused=true where singleton;
  end if;
  return jsonb_build_object('accepted',not discrepancy,'reason',case when discrepancy then 'usage_exceeded_reservation' else 'settled' end);
end $$;

create function radar_ai.recover() returns integer language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare n integer;
begin
  perform 1 from radar_ai.control where singleton for update;
  update radar_ai.operation set state='unknown',reason='worker_interrupted'
    where state in ('reserved','sent') and created_at<now()-interval '5 minutes';
  get diagnostics n=row_count;
  return n;
end $$;

-- No elevated login, passwords, allocation, prices or activation are installed here.
do $ownership$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname='radar_ai' loop
    execute format('alter table radar_ai.%I owner to radar_ai_owner',r.tablename);
    execute format('revoke all on table radar_ai.%I from public,radar_ai_worker,radar_reader,radar_editor',r.tablename);
  end loop;
  for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='radar_ai' loop
    execute format('alter function %s owner to radar_ai_owner',r.signature);
    execute format('revoke all on function %s from public,radar_reader,radar_editor,radar_ai_worker',r.signature);
  end loop;
end $ownership$;
grant execute on function radar_ai.status(),radar_ai.reserve(text,text,text,text,bigint,integer),radar_ai.mark_sent(uuid),radar_ai.finish(uuid,text,bigint,text),radar_ai.recover() to radar_ai_worker;
alter default privileges for role radar_ai_owner in schema radar_ai revoke all on functions from public;
