ALTER TABLE member_benefit
  ADD COLUMN audience text NOT NULL DEFAULT 'geral'
    CHECK (audience IN ('geral','estudantes','startups','organizacoes-sem-fins-lucrativos'));

CREATE TABLE member_benefit_monitor (
  benefit_id text PRIMARY KEY REFERENCES member_benefit(id) ON DELETE CASCADE,
  receipt_revision text NOT NULL CHECK (receipt_revision ~ '^[0-9a-f]{32}$'),
  outcome text NOT NULL CHECK (outcome IN ('verified','temporary','unavailable','review')),
  reason text NOT NULL,
  checked_at timestamptz NOT NULL,
  last_success_at timestamptz,
  CHECK (last_success_at IS NULL OR last_success_at <= checked_at)
);
REVOKE ALL ON member_benefit_monitor FROM PUBLIC;

CREATE FUNCTION public.member_benefit_monitor_revision(benefit public.member_benefit)
RETURNS text LANGUAGE sql STABLE SET TimeZone = 'UTC' SET search_path = pg_catalog, public AS $$
  SELECT md5(to_jsonb(benefit)::text)
$$;
REVOKE ALL ON FUNCTION public.member_benefit_monitor_revision(public.member_benefit) FROM PUBLIC;

CREATE FUNCTION public.member_benefit_is_available(benefit public.member_benefit)
RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT coalesce(benefit.status = 'published'
    AND benefit.evidence_url ~* '^https://'
    AND benefit.redemption_url ~* '^https://'
    AND (
      (benefit.starts_at <= now() AND benefit.ends_at > now())
      OR (benefit.verified_at IS NOT NULL AND benefit.verified_at <= now())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.member_benefit_organization o
      JOIN public.member_benefit_category c ON c.id = o.category_id
      WHERE o.benefit_id = benefit.id AND c.status <> 'published'
    )
    AND EXISTS (
      SELECT 1 FROM public.member_benefit_monitor m
      WHERE m.benefit_id = benefit.id
        AND m.receipt_revision = public.member_benefit_monitor_revision(benefit)
        AND m.outcome IN ('verified','temporary')
        AND m.last_success_at <= now()
        AND m.last_success_at > now() - interval '24 hours'
    ), false)
$$;
REVOKE ALL ON FUNCTION public.member_benefit_is_available(public.member_benefit) FROM PUBLIC;
