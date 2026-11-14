-- The former single selection remains intact, including non-event selections.
-- Event selections are counted lazily using the current, verified catalogue.
CREATE TABLE radar_free_event (
 user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
 opportunity_id text NOT NULL CHECK(opportunity_id ~ '^[A-Za-z0-9_-]{1,200}$'),
 slot smallint NOT NULL CHECK(slot BETWEEN 1 AND 10),
 opened_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,opportunity_id),
 UNIQUE(user_id,slot)
);
