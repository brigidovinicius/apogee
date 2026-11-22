-- Separate database gate. Apply after the existing behavior migrations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $migration$
DECLARE
  existing_check text;
BEGIN
  SELECT pg_get_expr(conbin, conrelid)
    INTO STRICT existing_check
    FROM pg_constraint
    WHERE conrelid = 'public.apogee_behavior_daily'::regclass
      AND conname = 'apogee_behavior_daily_check'
      AND contype = 'c';

  IF strpos(existing_check, 'drop_signup_completed') = 0 THEN
    EXECUTE format(
      'ALTER TABLE public.apogee_behavior_daily
        DROP CONSTRAINT apogee_behavior_daily_check,
        ADD CONSTRAINT apogee_behavior_daily_check CHECK ((%s)
          OR (page = %L AND event = %L AND target = %L))',
      existing_check, 'store', 'drop_signup_completed', 'waitlist'
    );
  END IF;
END;
$migration$;

COMMIT;
