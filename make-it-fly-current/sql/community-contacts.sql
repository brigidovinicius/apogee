CREATE TABLE public.community_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign text NOT NULL CHECK (campaign = 'codex'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254 AND email = lower(btrim(email))),
  goal text NOT NULL DEFAULT '' CHECK (char_length(goal) <= 600),
  consent_version text NOT NULL,
  consent_text text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_contact_campaign_email_key UNIQUE (campaign, email)
);
CREATE INDEX community_contact_consented_at_idx ON public.community_contact (consented_at DESC, id DESC);
COMMENT ON TABLE public.community_contact IS 'Apogee community contact capture v1; separate consent per campaign; no account or marketing enrollment';
