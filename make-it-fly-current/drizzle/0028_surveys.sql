CREATE TABLE apogee_survey (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  definition jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE apogee_survey_response (
  survey_id uuid NOT NULL REFERENCES apogee_survey(id),
  id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  research_notice text,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  collaboration text,
  collaboration_notice text,
  email text,
  radar_choice text CHECK (radar_choice IN ('allow', 'deny')),
  radar_notice text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > created_at),
  PRIMARY KEY (survey_id, id),
  CHECK (research_notice IS NOT NULL OR radar_choice IS NOT NULL),
  CHECK (research_notice IS NOT NULL OR (answers = '[]'::jsonb AND collaboration IS NULL)),
  CHECK ((collaboration IS NULL AND email IS NULL AND collaboration_notice IS NULL) OR
         (collaboration IS NOT NULL AND collaboration IN ('exercise', 'event', 'project') AND email IS NOT NULL AND collaboration_notice IS NOT NULL)),
  CHECK ((radar_choice IS NULL) = (radar_notice IS NULL))
);
--> statement-breakpoint
CREATE INDEX apogee_survey_response_expiry_idx ON apogee_survey_response (expires_at);
--> statement-breakpoint
CREATE INDEX apogee_survey_response_received_idx ON apogee_survey_response (survey_id, created_at DESC, id);
