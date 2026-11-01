CREATE TABLE radar_calendar_filter (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  filter_query text NOT NULL CHECK (length(filter_query) <= 2048),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX radar_calendar_filter_owner_name ON radar_calendar_filter (user_id, lower(name));
