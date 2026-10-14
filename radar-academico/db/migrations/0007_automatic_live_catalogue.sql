-- No pending item is promoted. Existing genuinely human-verified publications retain provenance.
alter table opportunities add column verified_at timestamptz;
alter table opportunities add column verification_method text check (verification_method in ('automatic','admin'));
alter table opportunities add column publication_issue text;
alter table opportunities add column deleted_at timestamptz;
alter table opportunities add column ingestion_origin text not null default 'automatic' check (ingestion_origin in ('automatic','manual'));
alter table opportunities add column version integer not null default 1;
alter table opportunities add column management_overrides jsonb not null default '{}'::jsonb;
select set_config('app.is_admin','true',true);
update opportunities set ingestion_origin='manual' where extraction_method='manual_assisted';
update opportunities set verified_at=human_verified_at,verification_method='admin'
where review_status='approved' and human_verified_at is not null;

create table opportunity_management_events (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references opportunities(id),
 actor text not null, action text not null, previous_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
alter table opportunity_management_events enable row level security;
alter table opportunity_management_events force row level security;
create policy management_events_admin on opportunity_management_events for all
 using (current_setting('app.is_admin', true)='true') with check (current_setting('app.is_admin', true)='true');

drop policy if exists opportunities_public on opportunities;
create policy opportunities_public on opportunities for select using (
opportunities.review_status='approved'
  and opportunities.verified_at is not null and opportunities.verification_method in ('automatic','admin')
  and opportunities.opportunity_status in ('open','upcoming') and not opportunities.source_conflict
  and opportunities.deleted_at is null and opportunities.publication_issue is null
  and opportunities.published_at is not null and ((opportunities.deadline_precision='continuous_flow' and opportunities.deadline_at is null)
  or (opportunities.deadline_precision='date_only' and (opportunities.deadline_at at time zone 'UTC')::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (opportunities.deadline_precision='exact_datetime' and opportunities.deadline_at >= now()))
  and exists (select 1 from official_sources s where s.id=opportunities.official_source_id and s.active and s.verification_status='verified')
);
drop policy if exists opportunity_sources_public on opportunity_sources;
create policy opportunity_sources_public on opportunity_sources for select using (
 active and exists (select 1 from opportunities o where o.id=opportunity_id and o.review_status='approved'
  and o.verified_at is not null and o.verification_method in ('automatic','admin')
  and o.opportunity_status in ('open','upcoming') and not o.source_conflict
  and o.deleted_at is null and o.publication_issue is null
  and o.published_at is not null and ((o.deadline_precision='continuous_flow' and o.deadline_at is null)
  or (o.deadline_precision='date_only' and (o.deadline_at at time zone 'UTC')::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (o.deadline_precision='exact_datetime' and o.deadline_at >= now()))
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified'))
);
create index opportunities_recheck on opportunities(last_source_check_at) where deleted_at is null;
