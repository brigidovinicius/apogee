-- A verified discovery target is not a publication authorization for its links.
-- Processing retains the separate human review status and existing dismissals.
alter table discovery_leads
  add column processing_status text not null default 'pending'
    check (processing_status in ('pending','processing','retry','blocked','completed','ignored')),
  add column processing_next_at timestamptz not null default now(),
  add column processing_lease_until timestamptz,
  add column processing_lease_token uuid,
  add column processing_attempts integer not null default 0 check (processing_attempts >= 0),
  add column processing_reason text check (processing_reason ~ '^[a-z][a-z0-9_]{0,79}$'),
  add column processed_at timestamptz,
  add column processing_source_id text references official_sources(id),
  add column processing_opportunity_id uuid references opportunities(id),
  add column processing_run_id uuid references ingestion_runs(id);

update discovery_leads set processing_status='ignored',processing_reason='previously_reviewed'
where status in ('mapped','dismissed');

create index discovery_leads_processing_due_idx
  on discovery_leads(processing_next_at, first_seen_at, id)
  where status in ('new','reviewing') and processing_status in ('pending','retry','processing');

create index discovery_leads_processing_lease_idx
  on discovery_leads(processing_lease_until) where processing_status='processing';

-- Existing radar_owner ownership, radar_editor grants and forced RLS are retained.
