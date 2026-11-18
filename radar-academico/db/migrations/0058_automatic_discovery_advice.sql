-- AI can rank existing public discovery leads. It cannot create facts or publish.
set local lock_timeout='5s';
set local statement_timeout='60s';
create table discovery_priority_hints (
 lead_id uuid primary key references discovery_leads(id) on delete cascade,
 task_id uuid not null, lead_url text not null, lead_title text not null, target_url text not null,
 priority smallint not null check(priority between 1 and 6),
 expires_at timestamptz not null, created_at timestamptz not null default now()
);
alter table discovery_priority_hints enable row level security;
alter table discovery_priority_hints force row level security;
revoke all on discovery_priority_hints from public,radar_reader,radar_ai_worker;
grant select,insert,update,delete on discovery_priority_hints to radar_editor;
create policy discovery_priority_admin on discovery_priority_hints for all to radar_editor
 using(current_setting('app.is_admin',true)='true') with check(current_setting('app.is_admin',true)='true');

-- Only the administrative scheduler can inspect its own bounded daily tasks.
create function radar_ai.automatic_discovery_context() returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
begin
 if current_setting('app.is_admin',true) is distinct from 'true' then raise exception 'administrative_context_required'; end if;
 return jsonb_build_object('day',(now() at time zone 'America/Sao_Paulo')::date,
   'budget_block',coalesce(radar_ai.block_reason(),case when not exists(
     select 1 from radar_ai.price p join radar_ai.response_tariff r on r.model=p.model and r.price_version=p.version
     where p.model='gpt-6-luna' and p.approved and r.approved and p.valid_until>now() and r.valid_until>now()
   ) then 'price_unverified' end),
   'model','gpt-6-luna',
   'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'key',t.task_key,'revision',t.revision,
     'requestHash',t.request_hash,'body',t.body,'stream',t.stream,'expiresAt',t.expires_at,
     'result',radar_ai.read_proposal(t.id,t.revision)))
     from radar_ai.task t where t.task_key like 'autodiscovery:v1:%' and t.created_at>now()-interval '2 days'), '[]'::jsonb));
end $$;
alter function radar_ai.automatic_discovery_context() owner to radar_ai_owner;
revoke all on function radar_ai.automatic_discovery_context() from public,radar_reader,radar_ai_worker;
grant execute on function radar_ai.automatic_discovery_context() to radar_editor;
