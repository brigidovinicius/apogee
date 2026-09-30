begin;

-- Existing applications remain available for manual review. Their new profile
-- fields are null because those questions did not exist when they were sent.
alter table public.applications
  add column age smallint check (age between 1 and 120),
  add column profession text check (char_length(profession) between 2 and 160),
  add column has_laptop boolean,
  add column journey_id uuid;

alter table public.applications
  drop constraint applications_eligibility_status,
  drop column eligible;

alter table public.applications
  add column eligible boolean generated always as (
    coalesce(age between 18 and 35, false)
    and has_idea
    and coalesce(has_laptop, false)
    and uses_paid_ai
  ) stored;

-- A legacy row cannot satisfy questions it was never asked. This status is an
-- internal compatibility label; the team's decision remains manual.
update public.applications
set status = 'NOT_ELIGIBLE'
where status = 'APPROVED' and not eligible;

alter table public.applications
  add constraint applications_eligibility_status check (
    (eligible and status = 'APPROVED')
    or (not eligible and status = 'NOT_ELIGIBLE')
    or status in ('CHECKOUT_STARTED', 'PURCHASED')
  );

comment on column public.applications.age is 'Self-declared age in completed years. Eligibility range is inclusive: 18 through 35.';
comment on column public.applications.profession is 'Self-declared profession, study field or area of interest. Informational only; it does not affect eligibility.';
comment on column public.applications.has_laptop is 'Whether the applicant can bring a notebook or portable computer to the event.';
comment on column public.applications.journey_id is 'Anonymous per-tab journey identifier used to connect first-party funnel events to a submitted application.';
comment on column public.applications.eligible is 'Internal criteria match only: age 18-35, idea, portable computer and paid AI use. It is not the team''s final approval decision.';
comment on column public.applications.status is 'APPROVED and NOT_ELIGIBLE are internal compatibility labels. CHECKOUT_STARTED and PURCHASED are retained only for historical records from the former checkout flow.';

create index applications_journey_id_idx on public.applications (journey_id) where journey_id is not null;

create table public.journey_events (
  id uuid primary key,
  journey_id uuid not null,
  event_name text not null check (event_name in (
    'page_view', 'section_view', 'scroll_depth', 'cta_click', 'form_view',
    'form_started', 'form_step_completed', 'form_validation_error',
    'form_submit_started', 'form_submit_succeeded', 'form_submit_failed'
  )),
  path text not null check (path in ('/', '/participar')),
  context text check (char_length(context) <= 160 and context ~ '^[a-z0-9_,.\-]+$'),
  step smallint check (step between 1 and 3),
  device text not null check (device in ('mobile', 'desktop')),
  created_at timestamptz not null default now()
);

create index journey_events_journey_created_idx on public.journey_events (journey_id, created_at);
create index journey_events_name_created_idx on public.journey_events (event_name, created_at desc);

alter table public.journey_events enable row level security;
revoke all on public.journey_events from public, anon, authenticated;
revoke all on public.journey_events from service_role;
grant select, insert on public.journey_events to service_role;

comment on table public.journey_events is 'First-party, server-only funnel events. No form answer values, URLs with query strings, IP addresses or user-agent strings are stored.';

commit;
