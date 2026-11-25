ALTER TABLE apogee_survey_response
  ADD COLUMN respondent_id text REFERENCES "user"(id) ON DELETE SET NULL,
  ADD CONSTRAINT apogee_survey_response_respondent_check
    CHECK (respondent_id IS NULL OR research_notice IS NOT NULL);
--> statement-breakpoint
CREATE INDEX apogee_survey_response_respondent_idx ON apogee_survey_response (respondent_id)
  WHERE respondent_id IS NOT NULL;
