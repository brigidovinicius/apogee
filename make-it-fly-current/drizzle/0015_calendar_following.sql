CREATE TABLE radar_calendar_follow (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 collection_id text NOT NULL REFERENCES radar_calendar_collection(id) ON DELETE CASCADE,
 share_version integer NOT NULL CHECK (share_version >= 0),
 followed_at timestamptz NOT NULL DEFAULT now(),
 digest_enabled boolean NOT NULL DEFAULT false,
 consented_at timestamptz,
 baseline jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(baseline) = 'object'),
 PRIMARY KEY (user_id, collection_id),
 CHECK (NOT digest_enabled OR consented_at IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX radar_calendar_follow_collection_idx ON radar_calendar_follow(collection_id);
--> statement-breakpoint
CREATE TABLE radar_calendar_digest_state (
 user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
 generation integer NOT NULL DEFAULT 0 CHECK (generation >= 0),
 unsubscribe_token text NOT NULL UNIQUE CHECK (unsubscribe_token ~ '^[a-f0-9]{48}$'),
 next_due_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
--> statement-breakpoint
CREATE TABLE radar_calendar_digest_job (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 period_start timestamptz NOT NULL,
 generation integer NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','failed','empty')),
 payload jsonb,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 created_at timestamptz NOT NULL DEFAULT now(),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token text,
 finished_at timestamptz,
 UNIQUE (user_id, period_start)
);
--> statement-breakpoint
CREATE INDEX radar_calendar_digest_due_idx ON radar_calendar_digest_state(next_due_at);
--> statement-breakpoint
CREATE TABLE radar_calendar_digest_budget (
 day date PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);
