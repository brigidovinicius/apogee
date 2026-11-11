-- Example for an already-created, approved runtime role. Not run automatically.
-- The migration owner remains separate; set its permissions as part of the authorized database change.
GRANT USAGE ON SCHEMA blog_worker TO apogee_blog_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA blog_worker TO apogee_blog_worker;
GRANT INSERT, UPDATE ON blog_worker.candidate, blog_worker.attempt,
  blog_worker.source_state, blog_worker.control, blog_worker.image_job,
  blog_worker.source_catalog, blog_worker.command TO apogee_blog_worker;
GRANT DELETE ON blog_worker.candidate TO apogee_blog_worker;
GRANT EXECUTE ON FUNCTION blog_worker.import_draft(text,jsonb) TO apogee_blog_worker;
-- No writes to benefit/subscription/migration; no public.blog_post or public.blog_post_event permissions.

GRANT EXECUTE ON FUNCTION blog_worker.queue_cover(text,text,text,text), blog_worker.import_cover(text,text) TO apogee_blog_worker;
GRANT SELECT ON blog_worker.dossier_version,blog_worker.post_review TO apogee_blog_worker;
GRANT SELECT,INSERT,DELETE ON blog_worker.captured_document TO apogee_blog_worker;
REVOKE ALL ON FUNCTION blog_worker.import_draft_legacy(text,jsonb) FROM apogee_blog_worker;
-- Runtime has NO INSERT/UPDATE/DELETE on dossier_version or post_review.
-- Web admin role, after its existing CMS grants (replace apogee_site as needed):
-- GRANT USAGE ON SCHEMA blog_worker TO apogee_site;
-- GRANT SELECT ON ALL TABLES IN SCHEMA blog_worker TO apogee_site;
-- GRANT INSERT, UPDATE ON blog_worker.source_catalog, blog_worker.command, blog_worker.image_job, blog_worker.control, blog_worker.candidate TO apogee_site;
-- GRANT INSERT ON blog_worker.operator_event TO apogee_site;
-- GRANT USAGE ON SEQUENCE blog_worker.operator_event_id_seq TO apogee_site;
-- GRANT EXECUTE ON FUNCTION blog_worker.import_cover(text,text) TO apogee_site;
-- GRANT INSERT ON blog_worker.dossier_version,blog_worker.post_review TO apogee_site;
-- GRANT USAGE ON SEQUENCE blog_worker.post_review_id_seq TO apogee_site;
-- No UPDATE/DELETE on immutable dossier versions or final-review history.

GRANT SELECT,INSERT,DELETE ON blog_worker.quota_observation TO apogee_blog_worker;
GRANT USAGE ON SEQUENCE blog_worker.quota_observation_id_seq TO apogee_blog_worker;

GRANT EXECUTE ON FUNCTION blog_worker.record_assisted_comparison(text,uuid,jsonb,jsonb) TO apogee_blog_worker;

GRANT EXECUTE ON FUNCTION blog_worker.prepare_automatic_research(text,jsonb,text) TO apogee_blog_worker;

GRANT SELECT ON blog_worker.google_access TO apogee_blog_worker;
GRANT EXECUTE ON FUNCTION blog_worker.claim_google_access(text,text),blog_worker.settle_google_access(uuid,jsonb) TO apogee_blog_worker;
-- Web: SELECT on google_access only; runtime cannot edit the original plan attestation.

-- Migration 007: reference registry is read-only for the runtime.
GRANT SELECT ON blog_worker.research_reference TO apogee_blog_worker;
-- GRANT SELECT ON blog_worker.research_reference TO apogee_site;
