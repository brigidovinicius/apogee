-- Local candidate. No activation, prices, credentials or external requests.
set local lock_timeout='5s';
set local statement_timeout='60s';
create table radar_ai.task (
  id uuid primary key default gen_random_uuid(), task_key text unique not null,
  subject text not null, revision text not null, request_hash text not null,
  envelope text not null, body jsonb not null, expires_at timestamptz not null,
  state text not null default 'pending' check(state in ('pending','running','proposed','held','stale','expired')),
  next_attempt_at timestamptz not null default now(), lease_token uuid, lease_until timestamptz,
  operation_id uuid unique references radar_ai.operation(id), created_at timestamptz not null default now(),
  unique(subject,revision,envelope,request_hash)
);
create index radar_ai_task_due on radar_ai.task(state,next_attempt_at,created_at);
create table radar_ai.proposal (
  task_id uuid primary key references radar_ai.task(id), operation_id uuid unique not null references radar_ai.operation(id),
  revision text not null, payload jsonb not null check(octet_length(payload::text)<=64000),
  created_at timestamptz not null default now()
);
create table radar_ai.reconciliation (
  operation_id uuid primary key references radar_ai.operation(id), reference text unique not null,
  outcome text not null check(outcome in ('confirmed','not_sent')), actual_micro bigint not null check(actual_micro>=0),
  operator_name text not null default session_user, created_at timestamptz not null default now()
);

create function radar_ai.enqueue(k text,s text,r text,h text,e text,b jsonb,expiry timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare t radar_ai.task;
begin
  if current_setting('app.is_admin',true) is distinct from 'true' then raise exception 'administrative_context_required'; end if;
  if k is null or k!~'^[a-zA-Z0-9:_-]{8,160}$' or s is null or length(s) not between 1 and 200 or
    r is null or r!~'^[a-f0-9]{64}$' or h is null or h!~'^[a-f0-9]{64}$' or
    e is null or e not in ('extraction','discovery','search','embeddings','evaluation') or
    b is null or jsonb_typeof(b)<>'object' or octet_length(b::text)>64000 or
    expiry is null or expiry<=now() or expiry>now()+interval '7 days' then raise exception 'invalid_task'; end if;
  -- Serialize revision changes and duplicate admission for a single subject.
  perform pg_advisory_xact_lock(hashtextextended('radar-ai:'||s,0));
  select * into t from radar_ai.task where task_key=k or (subject=s and revision=r and envelope=e and request_hash=h) limit 1;
  if found then return jsonb_build_object('status','duplicate','id',t.id,'matches',t.subject=s and t.revision=r and t.request_hash=h and t.envelope=e and t.body=b); end if;
  update radar_ai.task set state='stale' where subject=s and revision<>r and state in ('pending','running','proposed');
  insert into radar_ai.task(task_key,subject,revision,request_hash,envelope,body,expires_at)
    values(k,s,r,h,e,b,expiry) returning * into t;
  return jsonb_build_object('status','queued','id',t.id);
end $$;

create function radar_ai.claim_task() returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare t radar_ai.task; why text;
begin
  perform 1 from radar_ai.control where singleton for update;
  if not found then return jsonb_build_object('status','blocked','reason','control_unavailable'); end if;
  update radar_ai.task set state=case when operation_id is null then 'expired' else 'held' end
    where (state='pending' and expires_at<=now()) or (state='running' and lease_until<=now());
  why:=radar_ai.block_reason();
  if why is not null then return jsonb_build_object('status','blocked','reason',why); end if;
  if exists(select 1 from radar_ai.task where state='running') then return jsonb_build_object('status','busy'); end if;
  select * into t from radar_ai.task where state='pending' and expires_at>now() and next_attempt_at<=now()
    order by created_at,id limit 1 for update skip locked;
  if not found then return jsonb_build_object('status','empty'); end if;
  update radar_ai.task set state='running',lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes'
    where id=t.id returning * into t;
  return jsonb_build_object('status','claimed','task',to_jsonb(t));
end $$;

create function radar_ai.attach_task(tid uuid,token uuid,oid uuid) returns boolean language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
begin
  perform 1 from radar_ai.task t join radar_ai.operation o on o.id=oid
    where t.id=tid and t.lease_token=token and t.state='running' and t.lease_until>now() and t.expires_at>now()
      and t.operation_id is null and o.state='reserved' and o.operation_key=t.task_key and o.request_hash=t.request_hash and o.envelope=t.envelope
    for update of t;
  if not found then return false; end if;
  update radar_ai.task set operation_id=oid where id=tid;return true;
end $$;

create function radar_ai.complete_task(tid uuid,token uuid,payload jsonb) returns boolean language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare t radar_ai.task;
begin
  select * into t from radar_ai.task where id=tid for update;
  if not found or t.state<>'running' or t.lease_token is distinct from token or t.lease_until<=now() or t.expires_at<=now() or
    payload is null or octet_length(payload::text)>64000 or
    not exists(select 1 from radar_ai.operation where id=t.operation_id and state='confirmed' and actual_micro<=maximum_micro) then return false; end if;
  insert into radar_ai.proposal(task_id,operation_id,revision,payload) values(t.id,t.operation_id,t.revision,payload);
  update radar_ai.task set state='proposed',lease_until=null where id=tid;return true;
end $$;

create function radar_ai.defer_task(tid uuid,token uuid) returns boolean language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
begin
  update radar_ai.task set state=case when operation_id is not null then 'held' when expires_at<=now() then 'expired' else 'pending' end,
    lease_until=null,next_attempt_at=now()+interval '5 minutes'
    where id=tid and lease_token=token and state='running';
  return found;
end $$;

create function radar_ai.read_proposal(tid uuid,expected_revision text) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
begin
  if current_setting('app.is_admin',true) is distinct from 'true' then raise exception 'administrative_context_required'; end if;
  return (select jsonb_build_object('taskId',t.id,'revision',p.revision,'proposal',p.payload,'operationId',p.operation_id,'actualMicro',o.actual_micro)
    from radar_ai.task t join radar_ai.proposal p on p.task_id=t.id join radar_ai.operation o on o.id=p.operation_id
    where t.id=tid and t.state='proposed' and t.revision=expected_revision and p.revision=expected_revision and t.expires_at>now() and o.state='confirmed');
end $$;

-- Operator-only receipt reconciliation. It never requeues a task or removes a pause.
create function radar_ai.reconcile(oid uuid,outcome text,cost bigint,ref text) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare o radar_ai.operation;
begin
  perform 1 from radar_ai.control where singleton for update;
  select * into o from radar_ai.operation where id=oid for update;
  if not found or o.state<>'unknown' then return jsonb_build_object('accepted',false,'reason','not_unknown'); end if;
  if outcome is null or outcome not in ('confirmed','not_sent') or cost is null or cost<0 or (outcome='not_sent' and cost<>0) or
    ref is null or length(ref) not between 8 and 500 then raise exception 'invalid_receipt'; end if;
  insert into radar_ai.reconciliation(operation_id,reference,outcome,actual_micro) values(oid,ref,outcome,cost);
  update radar_ai.operation set state=outcome,actual_micro=cost,finished_at=now(),reason='operator_reconciled' where id=oid;
  if cost>o.maximum_micro then update radar_ai.control set manual_paused=true where singleton; end if;
  return jsonb_build_object('accepted',true,'requires_pause',cost>o.maximum_micro);
end $$;

do $permissions$ declare item record;
begin
  for item in select tablename from pg_tables where schemaname='radar_ai' and tablename in ('task','proposal','reconciliation') loop
    execute format('alter table radar_ai.%I owner to radar_ai_owner',item.tablename);
    execute format('revoke all on table radar_ai.%I from public,radar_ai_worker,radar_reader,radar_editor',item.tablename);
  end loop;
  for item in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='radar_ai' and p.proname in ('enqueue','claim_task','attach_task','complete_task','defer_task','read_proposal','reconcile') loop
    execute format('alter function %s owner to radar_ai_owner',item.signature);
    execute format('revoke all on function %s from public,radar_reader,radar_editor,radar_ai_worker',item.signature);
  end loop;
end $permissions$;
grant usage on schema radar_ai to radar_editor;
grant execute on function radar_ai.enqueue(text,text,text,text,text,jsonb,timestamptz) to radar_editor;
grant execute on function radar_ai.read_proposal(uuid,text) to radar_editor;
grant execute on function radar_ai.claim_task(),radar_ai.attach_task(uuid,uuid,uuid),radar_ai.complete_task(uuid,uuid,jsonb),radar_ai.defer_task(uuid,uuid) to radar_ai_worker;

-- Recheck task expiry/revision atomically with the existing financial send gate.
create or replace function radar_ai.mark_sent(operation_id uuid) returns jsonb language plpgsql security definer
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
  select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into committed from radar_ai.operation where cycle_id=c.cycle_id or state in ('reserved','sent','unknown');
  if committed>cap then why:='cycle_limit'; end if;
  select coalesce(sum(coalesce(actual_micro,maximum_micro)),0) into today from radar_ai.operation
    where id<>r.id and (coalesce(sent_at,created_at) at time zone 'America/Sao_Paulo')::date=(now() at time zone 'America/Sao_Paulo')::date;
  if today+r.maximum_micro>2000000 then why:='daily_limit'; end if;
  if exists(select 1 from radar_ai.operation where id<>r.id and state='sent') then why:='worker_busy'; end if;
  -- Lock the task so supersession cannot race this last eligibility check.
  perform 1 from radar_ai.task t where t.operation_id=r.id for update;
  if exists(select 1 from radar_ai.task t where t.operation_id=r.id and (t.state<>'running' or t.lease_until<=now() or t.expires_at<=now())) then why:='task_changed'; end if;
  if why is not null then
    update radar_ai.operation set state='not_sent',actual_micro=0,finished_at=now(),reason=why where id=operation_id;
    return jsonb_build_object('sent',false,'reason',why);
  end if;
  update radar_ai.operation set state='sent',sent_at=now() where id=operation_id;
  return jsonb_build_object('sent',true);
end $$;
