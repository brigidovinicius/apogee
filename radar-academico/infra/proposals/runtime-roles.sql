-- PROPOSAL ONLY. Not a migration. Never executed by the application or CI.
-- A DBA must inventory ownership, memberships, policies and a restorable backup.
-- Deliberately ends in ROLLBACK; no credentials or live role changes here.
BEGIN;
CREATE ROLE radar_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE radar_editor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO radar_reader, radar_editor;
GRANT SELECT ON opportunities, opportunity_sources TO radar_reader;
GRANT SELECT, INSERT, UPDATE ON official_sources, opportunities, opportunity_sources,
  opportunity_revisions, ingestion_runs TO radar_editor;

-- GUC app.is_admin alone is not a credential: restrict policies by DB role too.
ALTER POLICY official_sources_admin ON official_sources TO radar_editor;
ALTER POLICY opportunities_admin ON opportunities TO radar_editor;
ALTER POLICY opportunity_sources_admin ON opportunity_sources TO radar_editor;
ALTER POLICY opportunity_revisions_admin ON opportunity_revisions TO radar_editor;
ALTER POLICY ingestion_runs_admin ON ingestion_runs TO radar_editor;
ALTER POLICY official_sources_public ON official_sources TO radar_reader;
ALTER POLICY opportunities_public ON opportunities TO radar_reader;
ALTER POLICY opportunity_sources_public ON opportunity_sources TO radar_reader;
ALTER TABLE official_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE opportunities FORCE ROW LEVEL SECURITY;
ALTER TABLE opportunity_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE opportunity_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE ingestion_runs FORCE ROW LEVEL SECURITY;
ROLLBACK;
