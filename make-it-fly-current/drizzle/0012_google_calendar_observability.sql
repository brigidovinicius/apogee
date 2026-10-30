ALTER TABLE radar_google_calendar_queue_state
 ADD COLUMN worker_seen_at timestamptz,
 ADD COLUMN worker_state text CHECK(worker_state IS NULL OR worker_state IN ('running','ok','failed'));
--> statement-breakpoint
CREATE TABLE radar_google_calendar_metric (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 finished_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 duration_ms integer NOT NULL CHECK(duration_ms>=0),
 outcome text NOT NULL CHECK(outcome IN ('synced','pending','failed','disconnected','thrown')),
 google_calls integer NOT NULL CHECK(google_calls>=0),
 http_errors integer NOT NULL CHECK(http_errors>=0),
 network_errors integer NOT NULL CHECK(network_errors>=0),
 quota_responses integer NOT NULL CHECK(quota_responses>=0),
 events_changed integer NOT NULL CHECK(events_changed>=0)
);
--> statement-breakpoint
CREATE INDEX radar_google_calendar_metric_finished_idx ON radar_google_calendar_metric(finished_at);
