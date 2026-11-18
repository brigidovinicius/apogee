-- Preserve RLS while allowing native UUID equality to use an index. JSON
-- extraction inside a correlated history lookup cannot be promoted across RLS.
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table ingestion_runs add column discovery_lead_id uuid generated always as (
 case when (execution_metadata->>'lead_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 then (execution_metadata->>'lead_id')::uuid else null end
) stored;
create index ingestion_runs_discovery_lead_id_idx on ingestion_runs(discovery_lead_id);
