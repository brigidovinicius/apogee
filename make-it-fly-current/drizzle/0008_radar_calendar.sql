CREATE TABLE radar_saved_opportunity (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  opportunity_id text NOT NULL CHECK (opportunity_id ~ '^[A-Za-z0-9_-]{1,200}$'),
  snapshot jsonb NOT NULL,
  feed_history jsonb NOT NULL DEFAULT '[]',
  saved_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  PRIMARY KEY (user_id, opportunity_id)
);
--> statement-breakpoint
CREATE TABLE radar_calendar_feed (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
