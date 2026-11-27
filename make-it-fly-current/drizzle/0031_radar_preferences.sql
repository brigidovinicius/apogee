CREATE TABLE radar_preference (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  email_option text NOT NULL DEFAULT 'off' CHECK (email_option IN ('off', 'weekly', 'urgent')),
  email_enabled_at timestamptz,
  mail_checked_at timestamptz,
  CHECK ((email_option = 'off') = (email_enabled_at IS NULL))
);
--> statement-breakpoint
CREATE TABLE radar_recommendation_dismissal (
  user_id text NOT NULL REFERENCES radar_preference (user_id) ON DELETE CASCADE,
  opportunity_id text NOT NULL CHECK (opportunity_id ~ '^radar-[A-Za-z0-9_-]{1,194}$'),
  PRIMARY KEY (user_id, opportunity_id)
);
--> statement-breakpoint
CREATE TABLE radar_preference_delivery (
  user_id text NOT NULL REFERENCES radar_preference (user_id) ON DELETE CASCADE,
  delivery_key text NOT NULL,
  opportunity_ids text[] NOT NULL CHECK (cardinality(opportunity_ids) BETWEEN 1 AND 5),
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  PRIMARY KEY (user_id, delivery_key)
);
--> statement-breakpoint
CREATE TABLE radar_preference_mail_budget (
  day date PRIMARY KEY,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 50)
);
