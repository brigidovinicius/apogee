CREATE TABLE radar_google_calendar (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  refresh_token_encrypted text,
  calendar_id text CHECK (calendar_id IS NULL OR (calendar_id <> 'primary' AND length(calendar_id) BETWEEN 3 AND 1024)),
  connected_at timestamptz,
  last_synced_at timestamptz,
  next_sync_at timestamptz NOT NULL DEFAULT now(),
  last_error text CHECK (last_error IS NULL OR last_error IN ('reconnect','permission','quota','unavailable','invalid_response','access')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE radar_google_calendar_oauth (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  verifier_encrypted text NOT NULL,
  expires_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE TABLE radar_google_calendar_event (
  user_id text NOT NULL REFERENCES radar_google_calendar(user_id) ON DELETE CASCADE,
  entry_key text NOT NULL,
  event_id text NOT NULL CHECK (event_id ~ '^[a-f0-9]{64}$'),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  content_hash text NOT NULL,
  cancelled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, entry_key)
);
--> statement-breakpoint
CREATE INDEX radar_google_calendar_due_idx ON radar_google_calendar(next_sync_at) WHERE refresh_token_encrypted IS NOT NULL;
