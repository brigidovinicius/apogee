-- Additive enrichment. No activation, source insertion, reclassification or deletion.
alter table opportunities add column if not exists discovery jsonb not null default '{"areas":[],"editions":[]}';
alter table opportunities add constraint opportunity_discovery_object check (jsonb_typeof(discovery)='object');

create policy opportunities_calendar on opportunities for select to radar_reader using (
opportunities.verified_at is not null and opportunities.verification_method in ('automatic','admin')
  and opportunities.deleted_at is null and not opportunities.source_conflict
  and opportunities.opportunity_status in ('open','upcoming','closed','result_published')
  and (opportunities.publication_issue is null or opportunities.publication_issue in ('invalid_deadline','status_unconfirmed'))
  and opportunities.review_status in ('approved','needs_information')
  and exists (select 1 from official_sources s where s.id=opportunities.official_source_id and s.active and s.verification_status='verified')
  and exists (select 1 from jsonb_array_elements(coalesce(opportunities.discovery->'editions','[]')) e,
    jsonb_array_elements(coalesce(e->'stages','[]')) st
    where case when length(coalesce(st->>'end',st->>'start'))=10
      then (coalesce(st->>'end',st->>'start') || 'T23:59:59-03:00')::timestamptz
      else coalesce(st->>'end',st->>'start')::timestamptz end >= now())
);
create policy opportunity_sources_calendar on opportunity_sources for select to radar_reader using (active and exists (select 1 from opportunities o where o.id=opportunity_id and o.verified_at is not null and o.verification_method in ('automatic','admin')
  and o.deleted_at is null and not o.source_conflict
  and o.opportunity_status in ('open','upcoming','closed','result_published')
  and (o.publication_issue is null or o.publication_issue in ('invalid_deadline','status_unconfirmed'))
  and o.review_status in ('approved','needs_information')
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified')
  and exists (select 1 from jsonb_array_elements(coalesce(o.discovery->'editions','[]')) e,
    jsonb_array_elements(coalesce(e->'stages','[]')) st
    where case when length(coalesce(st->>'end',st->>'start'))=10
      then (coalesce(st->>'end',st->>'start') || 'T23:59:59-03:00')::timestamptz
      else coalesce(st->>'end',st->>'start')::timestamptz end >= now())));
