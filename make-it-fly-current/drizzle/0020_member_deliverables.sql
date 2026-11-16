CREATE TABLE member_benefit (
  id text PRIMARY KEY,
  name text NOT NULL,
  partner text NOT NULL,
  description text NOT NULL,
  evidence_url text NOT NULL DEFAULT '',
  eligibility text NOT NULL DEFAULT '',
  availability text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  redemption text NOT NULL DEFAULT '',
  redemption_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  reviewed_by text NOT NULL REFERENCES "user"(id),
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (status <> 'published' OR (length(evidence_url)>0 AND length(eligibility)>0 AND length(availability)>0 AND length(redemption)>0 AND starts_at IS NOT NULL AND ends_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE member_learning_track (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','preparing','archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  reviewed_by text NOT NULL REFERENCES "user"(id),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE member_learning_module (
  id text PRIMARY KEY,
  track_id text NOT NULL REFERENCES member_learning_track(id),
  name text NOT NULL,
  description text NOT NULL,
  deliverable text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','preparing','archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  reviewed_by text NOT NULL REFERENCES "user"(id),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE member_learning_activity (
  id text PRIMARY KEY,
  module_id text NOT NULL REFERENCES member_learning_module(id),
  name text NOT NULL,
  instructions text NOT NULL,
  resource_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','preparing','archived')),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 10000),
  reviewed_by text NOT NULL REFERENCES "user"(id),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE member_learning_progress (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  activity_id text NOT NULL REFERENCES member_learning_activity(id),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,activity_id)
);
--> statement-breakpoint
CREATE TABLE member_deliverable_audit (
  id text PRIMARY KEY,
  actor_id text NOT NULL REFERENCES "user"(id),
  entity_type text NOT NULL CHECK (entity_type IN ('benefit','track','module','activity')),
  entity_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create','update')),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX member_learning_module_track_order ON member_learning_module(track_id,sort_order,id);
--> statement-breakpoint
CREATE INDEX member_learning_activity_module_order ON member_learning_activity(module_id,sort_order,id);
--> statement-breakpoint
REVOKE ALL ON member_benefit,member_learning_track,member_learning_module,member_learning_activity,member_learning_progress,member_deliverable_audit FROM PUBLIC;
