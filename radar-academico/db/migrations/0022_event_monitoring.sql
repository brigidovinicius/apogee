-- Only confirmed open events may omit a registration deadline. No pending rows are promoted.
drop policy if exists opportunities_public on opportunities;
create policy opportunities_public on opportunities for select using (
opportunities.review_status='approved'
  and opportunities.verified_at is not null and opportunities.verification_method in ('automatic','admin')
  and opportunities.opportunity_status in ('open','upcoming') and not opportunities.source_conflict
  and opportunities.deleted_at is null and opportunities.publication_issue is null
  and opportunities.published_at is not null and ((opportunities.deadline_precision='continuous_flow' and opportunities.deadline_at is null)
  or (opportunities.deadline_precision='not_informed' and opportunities.deadline_at is null and 'eventos'=any(opportunities.categories)
    and opportunities.opportunity_status='open'
    and coalesce(opportunities.evidence_json->'event_start'->>'excerpt','')<>''
    and coalesce(opportunities.evidence_json->'registration_availability'->>'excerpt','')<>''
    and case when opportunities.event_starts_at ~ '^\d{4}-\d{2}-\d{2}$'
      then (opportunities.event_starts_at || 'T00:00:00-03:00')::timestamptz > now()
      when opportunities.event_starts_at ~ '^\d{4}-\d{2}-\d{2}T' then opportunities.event_starts_at::timestamptz > now()
      else false end)
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
  or (o.deadline_precision='not_informed' and o.deadline_at is null and 'eventos'=any(o.categories)
    and o.opportunity_status='open'
    and coalesce(o.evidence_json->'event_start'->>'excerpt','')<>''
    and coalesce(o.evidence_json->'registration_availability'->>'excerpt','')<>''
    and case when o.event_starts_at ~ '^\d{4}-\d{2}-\d{2}$'
      then (o.event_starts_at || 'T00:00:00-03:00')::timestamptz > now()
      when o.event_starts_at ~ '^\d{4}-\d{2}-\d{2}T' then o.event_starts_at::timestamptz > now()
      else false end)
  or (o.deadline_precision='date_only' and (o.deadline_at at time zone 'UTC')::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (o.deadline_precision='exact_datetime' and o.deadline_at >= now()))
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified'))
);

create table opportunity_alert_subscriptions (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references opportunities(id),
 email text not null check (length(email) <= 254),
 status text not null default 'pending' check (status in ('pending','active','unsubscribed','completed')),
 confirm_hash text not null, unsubscribe_hash text not null, unsubscribe_token text not null,
 confirm_expires_at timestamptz not null, consent_at timestamptz not null default now(),
 confirmed_at timestamptz, last_snapshot jsonb not null, checked_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (opportunity_id,email)
);
create table opportunity_alert_outbox (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references opportunity_alert_subscriptions(id) on delete cascade,
 fingerprint text not null, kind text not null check (kind in ('confirmation','change')),
 payload jsonb not null, status text not null default 'pending' check (status in ('pending','sending','sent','cancelled','failed')),
 attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz,
 created_at timestamptz not null default now(), sent_at timestamptz, unique (subscription_id,fingerprint)
);
create index alert_outbox_due on opportunity_alert_outbox(next_attempt_at) where status in ('pending','sending');
create index alert_subscriptions_due on opportunity_alert_subscriptions(checked_at) where status='active';
create table opportunity_alert_limits (key text primary key, count integer not null, resets_at timestamptz not null);
-- Subscriber addresses and bearer tokens never enter the public catalogue.
alter table opportunity_alert_subscriptions enable row level security;
alter table opportunity_alert_subscriptions force row level security;
create policy alert_subscriptions_admin on opportunity_alert_subscriptions for all using (current_setting('app.is_admin',true)='true') with check (current_setting('app.is_admin',true)='true');
alter table opportunity_alert_outbox enable row level security;
alter table opportunity_alert_outbox force row level security;
create policy alert_outbox_admin on opportunity_alert_outbox for all using (current_setting('app.is_admin',true)='true') with check (current_setting('app.is_admin',true)='true');
alter table opportunity_alert_limits enable row level security;
alter table opportunity_alert_limits force row level security;
create policy alert_limits_admin on opportunity_alert_limits for all using (current_setting('app.is_admin',true)='true') with check (current_setting('app.is_admin',true)='true');
