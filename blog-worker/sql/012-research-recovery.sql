-- Reopen only one failed comparison when actual evidence changes.
-- Existing holds, receipts, three-attempt ceiling and draft-only access remain.
CREATE OR REPLACE FUNCTION blog_worker.prepare_automatic_research(candidate_key text, document jsonb, source_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; doc jsonb; captured blog_worker.captured_document; source blog_worker.source_catalog; approved jsonb; digest text; previous blog_worker.dossier_version; refreshed boolean:=false; old_context jsonb; new_context jsonb; primary_capture blog_worker.captured_document;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE id=candidate_key FOR UPDATE;
 IF NOT FOUND OR c.post_id IS NOT NULL OR c.evidence_hash IS DISTINCT FROM source_hash
   OR c.reason IN ('operator_hold','source_changed_after_reservation','retention')
   THEN RETURN false; END IF;
 SELECT * INTO previous FROM blog_worker.dossier_version WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1;
 IF previous.candidate_id IS NOT NULL THEN
  IF c.content_kind<>'explainer' OR c.reason IS NULL OR c.reason NOT IN ('compatibility_below_90','critical_fact_unresolved')
    OR previous.actor_id IS DISTINCT FROM 'google_assisted' OR previous.reviewed_by IS NOT NULL
    OR previous.assessment->>'eligible' IS DISTINCT FROM 'false'
    OR previous.source_hash IS DISTINCT FROM c.evidence_hash
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'critical'='true' AND v->>'text' !~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y')
    OR (SELECT count(*) FROM blog_worker.attempt WHERE candidate_id=c.id)<>1
    OR EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id AND (kind<>'comparison' OR state NOT IN ('confirmed','failed')))
    OR document->>'category' IS DISTINCT FROM previous.document->>'category'
    OR document->'subcategory' IS DISTINCT FROM previous.document->'subcategory' THEN RETURN false; END IF;
  SELECT jsonb_agg(jsonb_build_object('url',d->'url','title',d->'title','text',d->'text','published_at',d->'published_at','rights_reference',d->'rights_reference','kind',d->'kind') ORDER BY n)
    INTO old_context FROM jsonb_array_elements(previous.document->'documents') WITH ORDINALITY t(d,n);
  SELECT jsonb_agg(jsonb_build_object('url',d->'url','title',d->'title','text',d->'text','published_at',d->'published_at','rights_reference',d->'rights_reference','kind',d->'kind') ORDER BY n)
    INTO new_context FROM jsonb_array_elements(document->'documents') WITH ORDINALITY t(d,n);
  IF old_context IS NOT DISTINCT FROM new_context THEN RETURN false; END IF;
  document:=jsonb_set(document,'{previous_critical_claims}',(SELECT jsonb_agg(jsonb_build_object('id',v->'id','text',v->'text')) FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'critical'='true' AND v->>'text' !~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y'));
  document:=jsonb_set(document,'{prior_evidence_gaps}',coalesce((SELECT jsonb_agg(v) FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'text' ~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y'),'[]'::jsonb));
  refreshed:=true;
 ELSIF document ? 'previous_critical_claims' THEN RETURN false;
 ELSIF c.first_attempt_day IS NOT NULL OR EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id) THEN RETURN false;
 END IF;
 IF document->>'schema_version' IS DISTINCT FROM '1' OR document->'claims' IS DISTINCT FROM '[]'::jsonb
   OR (NOT refreshed AND document->'documents'->0->>'url' IS DISTINCT FROM c.url) OR document->'documents'->0->>'kind' IS DISTINCT FROM 'primary'
   OR jsonb_typeof(document->'documents') IS DISTINCT FROM 'array' OR jsonb_array_length(document->'documents') NOT BETWEEN 2 AND 10 OR octet_length(document::text)>180000
   OR NOT ((document->>'category'='ciencia' AND coalesce(document->>'subcategory','') IN ('','aeroespacial','neurociencia'))
    OR (document->>'category'='tecnologia' AND coalesce(document->>'subcategory','') IN ('','ia','software-ferramentas','hardware-robotica'))
    OR (document->>'category'='negocios' AND coalesce(document->>'subcategory','') IN ('','marketing','empreendedorismo-startups'))) THEN RAISE EXCEPTION 'invalid_automatic_research'; END IF;
 IF c.content_kind='explainer' THEN
  IF document->'editorial'->>'kind' IS DISTINCT FROM 'explainer' OR document->'editorial'->>'key' IS DISTINCT FROM c.explainer_key
    OR document->'editorial'->>'question' IS DISTINCT FROM c.title OR document->>'event_key' IS DISTINCT FROM 'explainer:'||c.explainer_key
    OR jsonb_typeof(document->'editorial'->'as_of') IS DISTINCT FROM 'string'
    OR NOT ((document->'editorial'->>'as_of')::timestamptz BETWEEN now()-interval '24 hours' AND now()+interval '15 minutes') THEN RAISE EXCEPTION 'invalid_explainer_scope'; END IF;
 ELSIF document ? 'editorial' THEN RAISE EXCEPTION 'invalid_explainer_scope'; END IF;
 IF EXISTS(SELECT 1 FROM blog_worker.dossier_version v WHERE v.candidate_id<>c.id AND (v.document->>'event_key'=$2->>'event_key'
   OR (c.content_kind='news' AND coalesce(v.document->'editorial'->>'kind','news')='news' AND EXISTS
     (SELECT 1 FROM jsonb_array_elements(v.document->'documents') o JOIN jsonb_array_elements($2->'documents') n ON o->>'url'=n->>'url')))) THEN RETURN false; END IF;
 FOR doc IN SELECT value FROM jsonb_array_elements(document->'documents') LOOP
  SELECT * INTO captured FROM blog_worker.captured_document WHERE id=doc->>'capture_id';
  IF c.content_kind='explainer' THEN
   IF captured.document->'published_at' IS DISTINCT FROM doc->'published_at' OR jsonb_typeof(doc->'excerpt_offset') IS DISTINCT FROM 'number' OR coalesce(doc->>'excerpt_offset','') !~ '^[0-9]+$'
     OR (doc->>'excerpt_offset')::integer NOT BETWEEN 0 AND 12000
     OR jsonb_typeof(doc->'consulted_at') IS DISTINCT FROM 'string'
     OR (doc->>'consulted_at')::timestamptz IS DISTINCT FROM coalesce((captured.document->>'checked_at')::timestamptz,captured.captured_at)
     OR NOT ((doc->>'consulted_at')::timestamptz BETWEEN now()-interval '24 hours' AND now()+interval '15 minutes') THEN RAISE EXCEPTION 'unapproved_research_snapshot'; END IF;
  END IF;
  SELECT * INTO source FROM blog_worker.source_catalog WHERE id=captured.source_id;
  approved:=source.definition;
  IF approved IS NULL THEN SELECT definition INTO approved FROM blog_worker.research_reference WHERE id=captured.source_id; END IF;
  IF captured.id IS NULL OR approved->>'enabled' IS DISTINCT FROM 'true' OR coalesce(approved->>'content_approved',approved->>'feed_content_approved') IS DISTINCT FROM 'true'
   OR captured.document->>'url' IS DISTINCT FROM doc->>'url' OR captured.document->>'title' IS DISTINCT FROM doc->>'title'
   OR captured.document->>'rights_reference' IS DISTINCT FROM doc->>'rights_reference'
   OR (CASE WHEN c.content_kind='explainer' THEN doc->>'same_event' IS DISTINCT FROM 'false' OR doc->>'same_subject' IS DISTINCT FROM 'true' ELSE doc->>'same_event' IS DISTINCT FROM 'true' END) OR coalesce(doc->>'kind','') NOT IN ('primary','independent')
   OR coalesce(length(doc->>'text'),0) NOT BETWEEN 80 AND 12000 OR substring(captured.document->>'text' from (CASE WHEN c.content_kind='explainer' THEN (doc->>'excerpt_offset')::integer ELSE 0 END)+1 for length(doc->>'text')) IS DISTINCT FROM doc->>'text'
   OR encode(sha256(convert_to(doc->>'text','UTF8')),'hex') IS DISTINCT FROM doc->>'content_hash' THEN RAISE EXCEPTION 'unapproved_research_snapshot'; END IF;
 END LOOP;
 IF refreshed THEN
  SELECT * INTO primary_capture FROM blog_worker.captured_document WHERE id=($2->'documents'->0->>'capture_id');
  c.evidence:=jsonb_build_array(primary_capture.document||jsonb_build_object('id','E1'));
  c.evidence_hash:=encode(sha256(convert_to(blog_worker.canonical_json(c.evidence),'UTF8')),'hex');
  UPDATE blog_worker.candidate SET url=primary_capture.url,source_id=primary_capture.source_id,evidence=c.evidence,evidence_hash=c.evidence_hash WHERE id=c.id;
  source_hash:=c.evidence_hash;
 END IF;
 digest:=encode(sha256(convert_to(blog_worker.canonical_json(document),'UTF8')),'hex');
 INSERT INTO blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason)
 VALUES(c.id,coalesce(previous.revision,0)+1,document,digest,jsonb_build_object('hash',digest,'eligible',false,'comparison_verified',false,'total',0,'convergent',0,'percentage',null,'blockers',jsonb_build_array('comparison_incomplete','independence_unverified','critical_fact_unresolved','comparison_required')),
 CASE WHEN refreshed THEN 'automatic_research_recovery' ELSE 'automatic_research' END,source_hash,CASE WHEN refreshed THEN 'Reapuração automática limitada: evidência textual nova; rejeição e recibos anteriores preservados; exige nova comparação Google e revisão humana final' WHEN c.content_kind='explainer' THEN 'Explicativo: pergunta identificada, fontes públicas e datas preservadas; trechos contíguos; exige comparação e revisão humana final' ELSE 'Pesquisa automática por DOI/referência explícita; excertos de abertura e snapshots completos preservados; exige comparação e revisão humana final' END);
 UPDATE blog_worker.candidate SET status='held',reason='comparison_incomplete' WHERE id=c.id;
 INSERT INTO blog_worker.operator_event(actor_id,action,target) VALUES('automatic_research',CASE WHEN refreshed THEN 'research_refreshed' ELSE 'research_prepared' END,c.id);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION blog_worker.prepare_automatic_research(text,jsonb,text) FROM PUBLIC;


-- The database also prevents dropping an earlier unresolved critical fact.
CREATE OR REPLACE FUNCTION blog_worker.record_assisted_comparison(candidate_key text, attempt_key uuid, claims jsonb, assessment jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; a blog_worker.attempt; d blog_worker.dossier_version;
 document jsonb; doc jsonb; claim jsonb; cell jsonb; total integer; convergent integer:=0;
 contradiction boolean; pending boolean; supported boolean; critical boolean:=false; critical_ok boolean:=true;
 independent_ok boolean; eligible boolean; document_hash text; blockers text[]:='{}'; convergent_documents text[]:='{}';
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE id=candidate_key FOR UPDATE;
 SELECT * INTO a FROM blog_worker.attempt WHERE id=attempt_key AND candidate_id=candidate_key;
 SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=candidate_key ORDER BY revision DESC LIMIT 1;
 IF c.id IS NULL OR c.post_id IS NOT NULL OR a.state IS DISTINCT FROM 'confirmed' OR a.provider IS DISTINCT FROM 'google_subscription'
    OR a.kind IS DISTINCT FROM 'comparison' OR d.revision IS DISTINCT FROM a.dossier_revision OR d.document_hash IS DISTINCT FROM a.dossier_hash
    OR d.source_hash IS DISTINCT FROM c.evidence_hash OR c.reason='source_changed_after_reservation' THEN RAISE EXCEPTION 'stale_comparison'; END IF;
 IF (c.content_kind='explainer' AND (d.document->'editorial'->>'kind' IS DISTINCT FROM 'explainer' OR d.document->'editorial'->>'key' IS DISTINCT FROM c.explainer_key))
   OR (c.content_kind='news' AND d.document ? 'editorial') THEN RAISE EXCEPTION 'invalid_explainer_scope'; END IF;
 IF jsonb_typeof(claims) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_comparison'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d.document->'previous_critical_claims','[]'::jsonb)) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(claims) n WHERE n->>'text'=p->>'text' AND n->>'critical'='true')) THEN RAISE EXCEPTION 'critical_fact_omitted'; END IF;
 total:=jsonb_array_length(claims);
 IF total>16 OR jsonb_array_length(d.document->'documents') NOT BETWEEN 2 AND 10
    OR (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(claims) v)<>total THEN RAISE EXCEPTION 'invalid_comparison'; END IF;
 FOR claim IN SELECT value FROM jsonb_array_elements(claims) LOOP
   IF coalesce(claim->>'id','') !~ '^C[1-9][0-9]?$' OR coalesce(length(claim->>'text'),0) NOT BETWEEN 8 AND 500
      OR jsonb_typeof(claim->'critical') IS DISTINCT FROM 'boolean' OR jsonb_typeof(claim->'cells') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_claim'; END IF;
   IF jsonb_array_length(claim->'cells')<>jsonb_array_length(d.document->'documents')
      OR (SELECT count(DISTINCT v->>'document_id') FROM jsonb_array_elements(claim->'cells') v)<>jsonb_array_length(d.document->'documents') THEN RAISE EXCEPTION 'invalid_claim'; END IF;
   contradiction:=false; pending:=false; supported:=false;
   FOR cell IN SELECT value FROM jsonb_array_elements(claim->'cells') LOOP
     SELECT value INTO doc FROM jsonb_array_elements(d.document->'documents') WHERE value->>'id'=cell->>'document_id';
     IF doc IS NULL OR coalesce(cell->>'status','') NOT IN ('supports','contradicts','not_mentioned','unverifiable')
        OR jsonb_typeof(cell->'quote') IS DISTINCT FROM 'string' OR length(cell->>'quote')>700
        OR jsonb_typeof(cell->'note') IS DISTINCT FROM 'string' OR length(cell->>'note')>500 THEN RAISE EXCEPTION 'invalid_claim_cell'; END IF;
     IF cell->>'status' IN ('supports','contradicts') THEN
       IF length(cell->>'quote')<8 OR position(cell->>'quote' IN doc->>'text')=0 THEN RAISE EXCEPTION 'quote_not_in_document'; END IF;
     ELSIF cell->>'quote'<>'' THEN RAISE EXCEPTION 'invalid_claim_cell'; END IF;
     supported:=supported OR cell->>'status'='supports';
     contradiction:=contradiction OR cell->>'status'='contradicts';
     pending:=pending OR cell->>'status'='unverifiable';
   END LOOP;
   SELECT count(DISTINCT v->>'origin_url')>=2 AND count(DISTINCT v->>'publisher_key')>=2 INTO supported
     FROM jsonb_array_elements(d.document->'documents') v WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(claim->'cells') x WHERE x->>'document_id'=v->>'id' AND x->>'status'='supports');
   IF supported AND NOT contradiction AND NOT pending THEN
     convergent:=convergent+1;
     SELECT convergent_documents||coalesce(array_agg(x->>'document_id'),'{}'::text[]) INTO convergent_documents FROM jsonb_array_elements(claim->'cells') x WHERE x->>'status'='supports';
   ELSIF (claim->>'critical')::boolean THEN critical_ok:=false; END IF;
   critical:=critical OR (claim->>'critical')::boolean;
 END LOOP;
 IF total=0 THEN blockers:=array_append(blockers,'comparison_incomplete'); END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d.document->'documents') x WHERE CASE WHEN c.content_kind='explainer' THEN x->>'same_event' IS DISTINCT FROM 'false' OR x->>'same_subject' IS DISTINCT FROM 'true' ELSE x->>'same_event' IS DISTINCT FROM 'true' END)
 THEN blockers:=array_append(blockers,CASE WHEN c.content_kind='explainer' THEN 'subject_unverified' ELSE 'event_unverified' END); END IF;
 SELECT EXISTS(
   SELECT 1 FROM jsonb_array_elements(d.document->'documents') p, jsonb_array_elements(d.document->'documents') i
   WHERE p->>'kind'='primary' AND i->>'kind'='independent' AND p->>'origin_url'<>i->>'origin_url'
     AND p->>'publisher_key'<>i->>'publisher_key' AND length(i->>'independence_note')>=20
     AND p->>'id'=ANY(convergent_documents) AND i->>'id'=ANY(convergent_documents)
 ) INTO independent_ok;
 IF NOT independent_ok THEN blockers:=array_append(blockers,'independence_unverified'); END IF;
 IF NOT critical OR NOT critical_ok THEN blockers:=array_append(blockers,'critical_fact_unresolved'); END IF;
 IF total>0 AND convergent*100<total*90 THEN blockers:=array_append(blockers,'compatibility_below_90'); END IF;
 eligible:=cardinality(blockers)=0;
 document:=jsonb_set(d.document,'{claims}',claims);
 IF octet_length(document::text)>180000 THEN RAISE EXCEPTION 'invalid_dossier'; END IF;
 document_hash:=encode(sha256(convert_to(blog_worker.canonical_json(document),'UTF8')),'hex');
 IF assessment->>'hash' IS DISTINCT FROM document_hash OR (assessment->>'total')::integer IS DISTINCT FROM total
    OR (assessment->>'convergent')::integer IS DISTINCT FROM convergent OR (assessment->>'eligible')::boolean IS DISTINCT FROM eligible
    OR assessment->>'comparison_verified' IS DISTINCT FROM 'true' OR assessment->'blockers' IS DISTINCT FROM to_jsonb(blockers) THEN RAISE EXCEPTION 'invalid_assessment'; END IF;
 INSERT INTO blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason,comparison_attempt_id)
 VALUES(candidate_key,d.revision+1,document,document_hash,assessment,'google_assisted',c.evidence_hash,'Comparação assistida com matriz e trechos verificados',attempt_key);
 UPDATE blog_worker.candidate SET status=CASE WHEN eligible THEN 'ready' ELSE 'held' END,reason=blockers[1] WHERE id=candidate_key;
 RETURN d.revision+1;
END $$;
REVOKE ALL ON FUNCTION blog_worker.record_assisted_comparison(text,uuid,jsonb,jsonb) FROM PUBLIC;

