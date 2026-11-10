-- Runtime may seed only an unreviewed research dossier from approved, captured
-- RSS snapshots. It still cannot edit immutable versions or approve publication.
CREATE FUNCTION blog_worker.prepare_automatic_research(candidate_key text, document jsonb, source_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; doc jsonb; captured blog_worker.captured_document; source blog_worker.source_catalog; digest text;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE id=candidate_key FOR UPDATE;
 IF NOT FOUND OR c.post_id IS NOT NULL OR c.first_attempt_day IS NOT NULL OR c.evidence_hash IS DISTINCT FROM source_hash
   OR EXISTS(SELECT 1 FROM blog_worker.dossier_version WHERE candidate_id=c.id)
   OR EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id) THEN RETURN false; END IF;
 IF document->>'schema_version' IS DISTINCT FROM '1' OR document->'claims' IS DISTINCT FROM '[]'::jsonb
   OR document->'documents'->0->>'url' IS DISTINCT FROM c.url OR document->'documents'->0->>'kind' IS DISTINCT FROM 'primary'
   OR jsonb_typeof(document->'documents') IS DISTINCT FROM 'array' OR jsonb_array_length(document->'documents') NOT BETWEEN 2 AND 10 OR octet_length(document::text)>180000
   OR NOT ((document->>'category'='ciencia' AND coalesce(document->>'subcategory','') IN ('','aeroespacial','neurociencia'))
    OR (document->>'category'='tecnologia' AND coalesce(document->>'subcategory','') IN ('','ia','software-ferramentas','hardware-robotica'))
    OR (document->>'category'='negocios' AND coalesce(document->>'subcategory','') IN ('','marketing','empreendedorismo-startups'))) THEN RAISE EXCEPTION 'invalid_automatic_research'; END IF;
 FOR doc IN SELECT value FROM jsonb_array_elements(document->'documents') LOOP
  SELECT * INTO captured FROM blog_worker.captured_document WHERE id=doc->>'capture_id';
  SELECT * INTO source FROM blog_worker.source_catalog WHERE id=captured.source_id;
  IF captured.id IS NULL OR source.definition->>'enabled' IS DISTINCT FROM 'true' OR source.definition->>'feed_content_approved' IS DISTINCT FROM 'true'
   OR captured.document->>'url' IS DISTINCT FROM doc->>'url' OR captured.document->>'title' IS DISTINCT FROM doc->>'title'
   OR captured.document->>'rights_reference' IS DISTINCT FROM doc->>'rights_reference'
   OR doc->>'same_event' IS DISTINCT FROM 'true' OR coalesce(doc->>'kind','') NOT IN ('primary','independent')
   OR coalesce(length(doc->>'text'),0) NOT BETWEEN 80 AND 12000 OR left(captured.document->>'text',length(doc->>'text')) IS DISTINCT FROM doc->>'text'
   OR encode(sha256(convert_to(doc->>'text','UTF8')),'hex') IS DISTINCT FROM doc->>'content_hash' THEN RAISE EXCEPTION 'unapproved_research_snapshot'; END IF;
 END LOOP;
 digest:=encode(sha256(convert_to(blog_worker.canonical_json(document),'UTF8')),'hex');
 INSERT INTO blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason)
 VALUES(c.id,1,document,digest,jsonb_build_object('hash',digest,'eligible',false,'comparison_verified',false,'total',0,'convergent',0,'percentage',null,'blockers',jsonb_build_array('comparison_incomplete','independence_unverified','critical_fact_unresolved','comparison_required')),
 'automatic_research',source_hash,'Pesquisa automática por DOI/referência explícita; excertos de abertura e snapshots completos preservados; exige comparação e revisão humana final');
 UPDATE blog_worker.candidate SET status='held',reason='comparison_incomplete' WHERE id=c.id;
 INSERT INTO blog_worker.operator_event(actor_id,action,target) VALUES('automatic_research','research_prepared',c.id);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION blog_worker.prepare_automatic_research(text,jsonb,text) FROM PUBLIC;
