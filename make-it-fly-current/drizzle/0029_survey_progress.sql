CREATE TABLE apogee_survey_progress (
  survey_id uuid NOT NULL REFERENCES apogee_survey(id),
  id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('active', 'submitted', 'withdrawn')),
  last_stage text NOT NULL,
  stages text[] NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  research_notice text,
  touched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (survey_id, id),
  CHECK ((status = 'withdrawn' AND research_notice IS NULL AND cardinality(stages) = 0)
    OR (status <> 'withdrawn' AND research_notice IS NOT NULL AND last_stage = ANY(stages)))
);
--> statement-breakpoint
CREATE INDEX apogee_survey_progress_expiry_idx ON apogee_survey_progress (expires_at);
--> statement-breakpoint
CREATE INDEX apogee_survey_progress_survey_revision_idx ON apogee_survey_progress (survey_id, revision);
