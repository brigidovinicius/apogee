begin;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) between 3 and 254),
  phone text not null check (phone ~ '^[0-9]{10,15}$'),
  has_idea boolean not null,
  idea_description text check (char_length(idea_description) <= 2000),
  uses_paid_ai boolean not null,
  eligible boolean generated always as (has_idea and uses_paid_ai) stored,
  status text not null check (status in ('APPROVED', 'NOT_ELIGIBLE', 'CHECKOUT_STARTED', 'PURCHASED')),
  utm_source text check (char_length(utm_source) <= 200),
  utm_medium text check (char_length(utm_medium) <= 200),
  utm_campaign text check (char_length(utm_campaign) <= 200),
  utm_content text check (char_length(utm_content) <= 200),
  referrer text check (char_length(referrer) <= 2048),
  created_at timestamptz not null default now(),
  checkout_started_at timestamptz,
  purchased_at timestamptz,
  idempotency_key uuid not null unique,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  constraint applications_eligibility_status check (
    (has_idea and uses_paid_ai and status in ('APPROVED', 'CHECKOUT_STARTED', 'PURCHASED'))
    or (not (has_idea and uses_paid_ai) and status = 'NOT_ELIGIBLE')
  ),
  constraint applications_checkout_state check (
    (status in ('APPROVED', 'NOT_ELIGIBLE') and checkout_started_at is null)
    or (status in ('CHECKOUT_STARTED', 'PURCHASED') and checkout_started_at is not null)
  ),
  constraint applications_purchase_state check (
    (status = 'PURCHASED' and purchased_at is not null)
    or (status <> 'PURCHASED' and purchased_at is null)
  )
);

create index applications_created_at_idx on public.applications (created_at desc);
create index applications_status_idx on public.applications (status, created_at desc);

alter table public.applications enable row level security;
revoke all on public.applications from public, anon, authenticated;
revoke all on public.applications from service_role;
grant usage on schema public to service_role;
grant select, insert, update on public.applications to service_role;

comment on table public.applications is 'Make It Fly applications. Private server-only access; no public RLS policies. Eligibility is self-declared Sim + Sim, not identity verification.';
comment on column public.applications.purchased_at is 'Not populated by this application. Requires confirmed payment reconciliation; visiting checkout is not a purchase.';
comment on column public.applications.payload_hash is 'Server HMAC of normalized request for idempotency conflict checks. Never returned to the client.';

commit;
