create extension if not exists pgcrypto;

create table if not exists official_sources (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  institution_name text not null,
  institution_acronym text not null,
  source_type text not null check (source_type in ('federal_government','state_government','government_foundation','federal_university','state_university','federal_institute','public_research_institution','official_reference')),
  base_url text not null,
  allowed_domains text[] not null,
  allowed_path_prefixes text[] not null,
  listing_urls text[] not null,
  extraction_mode text not null check (extraction_mode in ('rss','html','pdf','api','sitemap','manual_assisted','reference_only','disabled')),
  audience_scope text[] not null default '{}',
  geographic_scope text[] not null default '{}',
  categories text[] not null default '{}',
  priority integer not null default 0,
  active boolean not null default false,
  verification_status text not null default 'pending',
  robots_checked_at timestamptz,
  terms_checked_at timestamptz,
  last_crawled_at timestamptz,
  next_crawl_at timestamptz,
  crawl_interval_hours integer not null default 24,
  contact_email text,
  notes text
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  institution text not null,
  review_status text not null default 'pending_review' check (review_status in ('pending_review','needs_information','approved','rejected','archived')),
  opportunity_status text not null default 'unknown' check (opportunity_status in ('upcoming','open','closed','suspended','cancelled','result_published','unknown')),
  applicant_type text not null check (applicant_type in ('undergraduate_student','postgraduate_student','high_school_student','graduate_professional','professor','researcher','company','institution','mixed')),
  application_route text not null check (application_route in ('direct_student_application','application_via_university','application_via_department','application_via_professor','application_via_project_coordinator','institutional_call','invitation_only','unclear')),
  target_academic_levels text[] not null default '{}',
  benefit_type text not null check (benefit_type in ('academic_scholarship','research_scholarship','extension_scholarship','monitor_scholarship','internship','financial_aid','housing_aid','mobility_aid','prize','project_funding','unpaid_opportunity','other')),
  deadline_at timestamptz,
  deadline_precision text not null check (deadline_precision in ('exact_datetime','date_only','period_only','continuous_flow','not_informed')),
  official_source_id text not null references official_sources(id),
  last_source_check_at timestamptz,
  next_source_check_at timestamptz,
  has_retification boolean not null default false,
  retification_summary text,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  source_conflict boolean not null default false,
  human_verified_at timestamptz,
  human_verified_by text,
  extraction_method text not null,
  extracted_at timestamptz not null default now(),
  evidence_json jsonb not null default '{}',
  content_hash text not null,
  canonical_key text not null,
  requirements_text text not null,
  amount_text text not null,
  published_at timestamptz,
  unique (official_source_id, content_hash)
);

create table if not exists opportunity_sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  official_source_id text not null references official_sources(id),
  source_role text not null check (source_role in ('primary_application_source','official_notice','official_document','official_retification','official_result','program_reference')),
  source_page_url text not null,
  official_notice_url text,
  official_document_url text,
  application_url text,
  source_title text,
  source_published_at timestamptz,
  retrieved_at timestamptz not null,
  last_checked_at timestamptz not null,
  source_last_modified_at timestamptz,
  content_hash text not null,
  source_excerpt text,
  document_page integer,
  is_primary boolean not null default false,
  active boolean not null default true,
  notes text
);

create table if not exists opportunity_revisions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  source_url text not null,
  revision_type text not null,
  previous_data jsonb not null,
  new_data jsonb not null,
  change_summary text not null,
  review_status text not null default 'pending_review',
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  official_source_id text references official_sources(id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('running','completed','completed_with_warnings','failed','skipped')),
  pages_checked integer not null default 0,
  items_discovered integer not null default 0,
  items_created integer not null default 0,
  items_updated integer not null default 0,
  items_ignored integer not null default 0,
  items_failed integer not null default 0,
  error_summary text,
  execution_metadata jsonb not null default '{}'
);

create index if not exists opportunities_review_status_idx on opportunities(review_status);
create index if not exists opportunities_deadline_idx on opportunities(deadline_at);
create index if not exists opportunities_canonical_key_idx on opportunities(official_source_id, canonical_key);
create index if not exists opportunity_sources_opportunity_idx on opportunity_sources(opportunity_id);
create index if not exists ingestion_runs_source_started_idx on ingestion_runs(official_source_id, started_at desc);

alter table official_sources enable row level security;
alter table official_sources force row level security;
alter table opportunities enable row level security;
alter table opportunities force row level security;
alter table opportunity_sources enable row level security;
alter table opportunity_sources force row level security;
alter table opportunity_revisions enable row level security;
alter table opportunity_revisions force row level security;
alter table ingestion_runs enable row level security;
alter table ingestion_runs force row level security;

drop policy if exists official_sources_admin on official_sources;
create policy official_sources_admin on official_sources for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
drop policy if exists official_sources_public on official_sources;
create policy official_sources_public on official_sources for select using (active = true and verification_status = 'verified');

drop policy if exists opportunities_admin on opportunities;
create policy opportunities_admin on opportunities for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
drop policy if exists opportunities_public on opportunities;
create policy opportunities_public on opportunities for select using (
  review_status = 'approved' and human_verified_at is not null and opportunity_status = 'open'
  and published_at is not null and (deadline_at is null or deadline_at >= now())
);

drop policy if exists opportunity_sources_admin on opportunity_sources;
create policy opportunity_sources_admin on opportunity_sources for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
drop policy if exists opportunity_sources_public on opportunity_sources;
create policy opportunity_sources_public on opportunity_sources for select using (
  active = true and exists (
    select 1 from opportunities o where o.id = opportunity_id
      and o.review_status = 'approved' and o.human_verified_at is not null
      and o.opportunity_status = 'open' and o.published_at is not null
  )
);

drop policy if exists opportunity_revisions_admin on opportunity_revisions;
create policy opportunity_revisions_admin on opportunity_revisions for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
drop policy if exists ingestion_runs_admin on ingestion_runs;
create policy ingestion_runs_admin on ingestion_runs for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');