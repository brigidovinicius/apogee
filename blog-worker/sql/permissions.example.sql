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
-- Web admin role, after its existing CMS grants (replace apogee_site as needed):
-- GRANT USAGE ON SCHEMA blog_worker TO apogee_site;
-- GRANT SELECT ON ALL TABLES IN SCHEMA blog_worker TO apogee_site;
-- GRANT INSERT, UPDATE ON blog_worker.source_catalog, blog_worker.command, blog_worker.image_job, blog_worker.control, blog_worker.candidate TO apogee_site;
-- GRANT INSERT ON blog_worker.operator_event TO apogee_site;
-- GRANT USAGE ON SEQUENCE blog_worker.operator_event_id_seq TO apogee_site;
-- GRANT EXECUTE ON FUNCTION blog_worker.import_cover(text,text) TO apogee_site;
