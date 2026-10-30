ALTER TABLE radar_google_calendar
 ADD COLUMN consecutive_failures integer NOT NULL DEFAULT 0 CHECK(consecutive_failures BETWEEN 0 AND 1000000),
 ADD COLUMN retry_not_before timestamptz,
 ADD COLUMN retry_paused boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE radar_google_calendar_queue_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 cooldown_until timestamptz
);
--> statement-breakpoint
INSERT INTO radar_google_calendar_queue_state(singleton) VALUES (true);
