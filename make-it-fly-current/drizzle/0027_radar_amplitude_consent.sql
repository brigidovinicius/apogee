CREATE TABLE radar_amplitude_consent (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  grant_id uuid NOT NULL,
  policy_version integer NOT NULL CONSTRAINT radar_amplitude_consent_policy_version_check CHECK (policy_version > 0),
  granted_at timestamptz NOT NULL DEFAULT now()
);
