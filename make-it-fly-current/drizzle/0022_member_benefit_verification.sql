ALTER TABLE member_benefit ADD COLUMN verified_at timestamptz;
ALTER TABLE member_benefit DROP CONSTRAINT member_benefit_check1;
ALTER TABLE member_benefit ADD CONSTRAINT member_benefit_check1 CHECK (
  status <> 'published' OR (
    length(evidence_url) > 0 AND length(eligibility) > 0
    AND length(availability) > 0 AND length(redemption) > 0
    AND ((starts_at IS NOT NULL AND ends_at IS NOT NULL)
      OR (verified_at IS NOT NULL AND length(redemption_url) > 0))
  )
);
ALTER TABLE member_benefit ADD CONSTRAINT member_benefit_verification_mode CHECK (
  verified_at IS NULL OR (starts_at IS NULL AND ends_at IS NULL)
);

-- A missed review automatically closes every read and redemption path.
CREATE FUNCTION public.member_benefit_is_current(starts_at timestamptz, ends_at timestamptz, verified_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN verified_at IS NULL
    THEN starts_at <= now() AND ends_at > now()
    ELSE verified_at <= now() AND verified_at > now() - interval '168 hours'
  END
$$;
