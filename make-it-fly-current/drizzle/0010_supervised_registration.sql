ALTER TABLE "user" ADD COLUMN adult_declared boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE member_adult_review (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewer_id text REFERENCES "user"(id) ON DELETE SET NULL,
 evidence_reference text,
 CHECK(status <> 'approved' OR (reviewed_at IS NOT NULL AND evidence_reference IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE member_dependent (
 id text PRIMARY KEY,
 guardian_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 nickname text NOT NULL CHECK(length(nickname) BETWEEN 2 AND 40),
 age_band text NOT NULL CHECK(age_band IN ('under_12','12_15','16_17')),
 relationship text NOT NULL CHECK(relationship IN ('parent','legal_guardian')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','revoked')),
 consent_version text NOT NULL,
 consent_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz,
 reviewer_id text REFERENCES "user"(id) ON DELETE SET NULL,
 evidence_reference text,
 CHECK(status <> 'approved' OR (reviewed_at IS NOT NULL AND evidence_reference IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE member_protection_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
 subject_id text NOT NULL,
 action text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX member_dependent_guardian_idx ON member_dependent(guardian_id,status);
