-- Preserve source precision: a date without a time is not a midnight timestamp.
alter table opportunities add column event_starts_at text;
comment on column opportunities.event_starts_at is 'Confirmed event start: YYYY-MM-DD or ISO timestamp with explicit timezone; NULL when unknown.';
