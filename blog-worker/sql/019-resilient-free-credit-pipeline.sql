-- Optional, free-credit-only recovery for comparison and covers.
-- Same immutable evidence, 90%, critical facts, media and hourly/catch-up gates.
-- No new runtime grants, billing settings or publishing authorization.
CREATE FUNCTION blog_worker.valid_generation_receipt(attempt_key uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a blog_worker.attempt; b blog_worker.benefit; months integer; cap bigint;
BEGIN
 SELECT * INTO a FROM blog_worker.attempt WHERE id=attempt_key;
 IF a.id IS NULL OR a.kind NOT IN ('text','comparison','image') OR a.state<>'confirmed' OR a.reason IS NOT NULL OR a.finished_at IS NULL THEN RETURN false; END IF;
 IF a.provider='google_subscription' THEN
   RETURN a.charged_micro_usd=0 AND a.quota_used IS NOT NULL AND a.quota_used<=a.quota_reserved;
 END IF;
 IF a.provider<>'openai_api' OR a.policy->>'editorial_pipeline' IS DISTINCT FROM 'google_multisource_v1'
   OR a.policy->>'model_id' IS DISTINCT FROM 'gpt-6-luna' OR a.price->>'model' IS DISTINCT FROM (CASE WHEN a.kind='image' THEN 'gpt-image-2.5-flare-2026-09-08' ELSE 'gpt-6-luna' END)
   OR (a.kind<>'text' AND a.policy->>'api_operation' IS DISTINCT FROM a.kind)
   OR (a.kind='image' AND (a.policy->>'automatic_image_generation_enabled' IS DISTINCT FROM 'true'
     OR a.policy->>'image_model_id' IS DISTINCT FROM 'gpt-image-2.5-flare-2026-09-08'
     OR a.policy->>'image_quality' IS DISTINCT FROM 'low' OR a.price->>'quality' IS DISTINCT FROM 'low'
     OR a.policy->>'image_size' IS DISTINCT FROM '1536x1024' OR a.price->>'size' IS DISTINCT FROM '1536x1024'))
   OR a.price->>'approved' IS DISTINCT FROM 'true'
   OR a.policy#>>'{editorial_policy,minimum_compatibility_basis_points}' IS DISTINCT FROM '9000'
   OR a.policy#>>'{editorial_policy,critical_fact_confirmation_required}' IS DISTINCT FROM 'true'
   OR a.policy->>'auto_recharge_enabled' IS DISTINCT FROM 'false' OR a.policy->>'paid_balance_fallback_enabled' IS DISTINCT FROM 'false'
   OR a.policy->>'codex_subscription_execution_enabled' IS DISTINCT FROM 'false'
   OR a.reserved_micro_usd<=0 OR a.charged_micro_usd IS NULL OR a.charged_micro_usd>a.reserved_micro_usd
   OR a.usage->>'not_generated'='true' THEN RETURN false; END IF;
 SELECT * INTO b FROM blog_worker.benefit WHERE id=a.benefit_id;
 IF b.id IS NULL OR b.revoked_at IS NOT NULL OR a.created_at<b.starts_at OR a.finished_at>=b.expires_at
   OR b.attestation->>'no_auto_recharge' IS DISTINCT FROM 'true'
   OR b.attestation->>'balance_type' IS DISTINCT FROM 'included_subscription_benefit_only' THEN RETURN false; END IF;
 IF b.attestation->>'billing_scope'='isolated_free_credit_organization' THEN
   RETURN coalesce(b.attestation->>'no_paid_balance'='true' AND b.attestation->>'no_paid_billing'='true' AND b.attestation->>'dedicated_project'='true',false);
 END IF;
 IF b.attestation->>'billing_scope' IS DISTINCT FROM 'verified_organization_hard_limit'
   OR b.attestation->>'organization_hard_limit_enforced' IS DISTINCT FROM 'true'
   OR b.attestation->>'hard_limit_scope' IS DISTINCT FROM 'all_organization_projects'
   OR b.attestation->>'dedicated_blog_key' IS DISTINCT FROM 'true'
   OR b.attestation->>'limit_change_invalidates_authorization' IS DISTINCT FROM 'true'
   OR b.expires_at-b.starts_at>interval '31 days'
   OR coalesce((b.attestation->>'credit_safety_buffer_micro_usd')::bigint,0)<20000000 THEN RETURN false; END IF;
 cap:=(b.attestation->>'organization_monthly_limit_micro_usd')::bigint;
 months:=(extract(year from (b.expires_at-interval '1 microsecond') AT TIME ZONE 'UTC')::integer-extract(year from b.starts_at AT TIME ZONE 'UTC')::integer)*12
   +extract(month from (b.expires_at-interval '1 microsecond') AT TIME ZONE 'UTC')::integer-extract(month from b.starts_at AT TIME ZONE 'UTC')::integer+1;
 RETURN coalesce(cap BETWEEN 1 AND 10000000 AND months BETWEEN 1 AND 2
   AND b.remaining_micro_usd>=cap*months+(b.attestation->>'credit_safety_buffer_micro_usd')::bigint,false);
END $$;
REVOKE ALL ON FUNCTION blog_worker.valid_generation_receipt(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION blog_worker.valid_text_receipt(attempt_key uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce((SELECT kind='text' FROM blog_worker.attempt WHERE id=attempt_key),false)
   AND blog_worker.valid_generation_receipt(attempt_key)
$$;

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
 IF c.id IS NULL OR c.post_id IS NOT NULL OR a.state IS DISTINCT FROM 'confirmed' OR blog_worker.valid_generation_receipt(a.id) IS DISTINCT FROM true
    OR a.kind IS DISTINCT FROM 'comparison' OR d.revision IS DISTINCT FROM a.dossier_revision OR d.document_hash IS DISTINCT FROM a.dossier_hash
    OR d.source_hash IS DISTINCT FROM c.evidence_hash OR c.reason='source_changed_after_reservation' THEN RAISE EXCEPTION 'stale_comparison'; END IF;
 IF (c.content_kind='explainer' AND (d.document->'editorial'->>'kind' IS DISTINCT FROM 'explainer' OR d.document->'editorial'->>'key' IS DISTINCT FROM c.explainer_key))
   OR (c.content_kind='news' AND d.document ? 'editorial') THEN RAISE EXCEPTION 'invalid_explainer_scope'; END IF;
 IF jsonb_typeof(claims) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_comparison'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d.document->'previous_critical_claims','[]'::jsonb)) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(claims) n WHERE n->>'text'=p->>'text' AND n->>'critical'='true')) THEN RAISE EXCEPTION 'critical_fact_omitted'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(d.document->'previous_unresolved_claims','[]'::jsonb)) p WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(claims) n WHERE n->>'text'=p->>'text' AND (p->>'critical'<>'true' OR n->>'critical'='true'))) THEN RAISE EXCEPTION 'previous_fact_omitted'; END IF;
 IF a.ordinal>2 AND (d.actor_id IS DISTINCT FROM 'automatic_research_recovery' OR d.document->'recovery'->>'maximum_editorial_attempts' IS DISTINCT FROM '4'
   OR NOT EXISTS(SELECT 1 FROM blog_worker.attempt previous_attempt WHERE previous_attempt.candidate_id=c.id AND previous_attempt.id::text=d.document->'recovery'->>'comparison_attempt_id' AND previous_attempt.kind='comparison' AND previous_attempt.state='confirmed' AND previous_attempt.reason IS NULL AND previous_attempt.dossier_revision<d.revision)
   OR NOT EXISTS(SELECT 1 FROM blog_worker.attempt previous_attempt WHERE previous_attempt.candidate_id=c.id AND previous_attempt.id::text=d.document->'recovery'->>'prior_format_attempt_id' AND previous_attempt.kind='comparison' AND previous_attempt.state='confirmed' AND previous_attempt.reason IN ('invalid_structure','invalid_comparison','invalid_claim','invalid_claim_cell','invalid_dossier','duplicate_claim','quote_not_in_document','invalid_quote_reference') AND previous_attempt.dossier_revision<d.revision)) THEN RAISE EXCEPTION 'recovery_allowance_unverified'; END IF;
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
 VALUES(candidate_key,d.revision+1,document,document_hash,assessment,CASE WHEN a.provider='google_subscription' THEN 'google_assisted' ELSE 'openai_assisted' END,c.evidence_hash,'Comparação assistida com matriz e trechos verificados',attempt_key);
 UPDATE blog_worker.candidate SET status=CASE WHEN eligible THEN 'ready' ELSE 'held' END,reason=blockers[1] WHERE id=candidate_key;
 RETURN d.revision+1;
END $$;
REVOKE ALL ON FUNCTION blog_worker.record_assisted_comparison(text,uuid,jsonb,jsonb) FROM PUBLIC;

CREATE OR REPLACE FUNCTION blog_worker.schedule_automatic_publication() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE policy blog_worker.publication_policy; c blog_worker.candidate; p public.blog_post;
 d blog_worker.dossier_version; j blog_worker.image_job; m public.blog_media;
 t blog_worker.attempt; i blog_worker.attempt; comparison blog_worker.attempt;
 generated jsonb; selected_topic text; topic_cap integer; at_time timestamptz:=clock_timestamp();
 target_day date; slot timestamptz; occupied timestamptz[]; offset_day integer; remaining integer; available integer; cadence text;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton AND NOT paused FOR UPDATE;
 IF NOT FOUND THEN RETURN '{"status":"blocked","reason":"paused"}'::jsonb; END IF;
 SELECT * INTO policy FROM blog_worker.publication_policy WHERE singleton;
 IF NOT policy.enabled THEN RETURN '{"status":"disabled"}'::jsonb; END IF;
 IF (at_time AT TIME ZONE 'America/Sao_Paulo')::date<policy.starts_on THEN RETURN '{"status":"waiting","reason":"publication_start_day"}'::jsonb; END IF;
 FOR c IN SELECT candidate.* FROM blog_worker.candidate candidate JOIN public.blog_post post ON post.id=candidate.post_id
   WHERE candidate.status='draft' AND candidate.reason='human_review_required' AND post.status='draft'
     AND post.created_at>=policy.intake_not_before AND post.created_at>=policy.starts_on::timestamp AT TIME ZONE 'America/Sao_Paulo'
     AND NOT EXISTS(SELECT 1 FROM blog_worker.publication_receipt r WHERE r.candidate_id=candidate.id)
   ORDER BY post.created_at,post.id LIMIT 50
 LOOP
   SELECT * INTO p FROM public.blog_post WHERE id=c.post_id FOR UPDATE;
   SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1;
   SELECT * INTO j FROM blog_worker.image_job WHERE candidate_id=c.id;
   SELECT * INTO m FROM public.blog_media WHERE id=p.cover_media_id AND post_id=p.id;
   SELECT * INTO t FROM blog_worker.attempt WHERE candidate_id=c.id AND kind='text' AND state='confirmed' AND reason IS NULL ORDER BY finished_at DESC LIMIT 1;
   SELECT * INTO i FROM blog_worker.attempt WHERE candidate_id=c.id AND kind='image' AND state='confirmed' AND reason IS NULL ORDER BY finished_at DESC LIMIT 1;
   SELECT * INTO comparison FROM blog_worker.attempt WHERE id=d.comparison_attempt_id;
   selected_topic:=CASE WHEN d.document->>'category'='negocios' THEN 'business' WHEN d.document->>'category'='tecnologia' THEN CASE WHEN d.document->>'subcategory'='ia' THEN 'ai' ELSE 'technology' END END;
   IF selected_topic IS NULL OR d.source_hash IS DISTINCT FROM c.evidence_hash OR d.assessment->>'eligible' IS DISTINCT FROM 'true'
     OR d.assessment->>'comparison_verified' IS DISTINCT FROM 'true' OR coalesce((d.assessment->>'percentage')::numeric,0)<90
     OR comparison.id IS NULL OR comparison.kind<>'comparison' OR comparison.state<>'confirmed' OR comparison.reason IS NOT NULL
     OR blog_worker.valid_generation_receipt(comparison.id) IS DISTINCT FROM true OR comparison.finished_at<at_time-interval '48 hours'
     OR blog_worker.valid_text_receipt(t.id) IS DISTINCT FROM true
     OR t.dossier_revision IS DISTINCT FROM d.revision OR t.dossier_hash IS DISTINCT FROM d.document_hash
     OR t.day<policy.starts_on OR t.created_at<policy.intake_not_before OR t.finished_at<at_time-interval '48 hours'
     OR blog_worker.valid_generation_receipt(i.id) IS DISTINCT FROM true
     OR j.state IS DISTINCT FROM 'completed' OR j.media_id IS DISTINCT FROM p.cover_media_id OR m.id IS NULL
     OR m.alt IS DISTINCT FROM j.alt OR m.caption IS DISTINCT FROM j.caption
     OR coalesce(length(m.alt),0)<3 OR coalesce(length(m.caption),0)<10 OR position('Apogee' IN m.caption)=0
     OR position('inteligência artificial' IN m.caption)=0 OR octet_length(m.image)<100
     OR p.revision<>j.expected_revision+1 OR p.published_at IS NOT NULL OR p.scheduled_at IS NOT NULL
     OR NOT p.seo_noindex OR p.video_url IS NOT NULL OR coalesce(length(p.seo_title),0) NOT BETWEEN 10 AND 70
     OR coalesce(length(p.seo_description),0) NOT BETWEEN 40 AND 160
     OR EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id AND state IN ('reserved','unknown'))
     OR EXISTS(SELECT 1 FROM blog_worker.post_review WHERE post_id=p.id) THEN CONTINUE; END IF;
   generated:=c.artifact->'generated_post';
   IF generated IS NULL OR generated->>'title' IS DISTINCT FROM p.title OR generated->>'excerpt' IS DISTINCT FROM p.excerpt
     OR generated->>'body' IS DISTINCT FROM p.body OR generated->>'category' IS DISTINCT FROM p.category
     OR generated->>'slug' IS DISTINCT FROM p.slug OR generated->>'seo_title' IS DISTINCT FROM p.seo_title
     OR generated->>'seo_description' IS DISTINCT FROM p.seo_description THEN CONTINUE; END IF;
   topic_cap:=CASE WHEN selected_topic='technology' THEN 4 ELSE 3 END; slot:=NULL;
   FOR offset_day IN 0..1 LOOP
     target_day:=(at_time AT TIME ZONE 'America/Sao_Paulo')::date+offset_day;
     IF (SELECT count(*) FROM blog_worker.publication_receipt WHERE publication_day=target_day)>=10
       OR (SELECT count(*) FROM blog_worker.publication_receipt r WHERE r.publication_day=target_day AND r.topic=selected_topic)>=topic_cap
       OR (SELECT count(*) FROM blog_worker.publication_receipt WHERE date_trunc('week',publication_day::timestamp)=date_trunc('week',target_day::timestamp))>=70 THEN CONTINUE; END IF;
     SELECT coalesce(array_agg(scheduled_at),'{}'::timestamptz[]) INTO occupied FROM blog_worker.publication_receipt WHERE publication_day=target_day;
     cadence:='hourly';
     slot:=blog_worker.hourly_publication_slot(at_time,target_day,policy.first_hour,policy.last_hour,occupied);
     IF offset_day=0 AND policy.catch_up_enabled AND target_day>=policy.catch_up_starts_on THEN
       SELECT 10-count(*) INTO remaining FROM blog_worker.publication_receipt WHERE publication_day=target_day;
       SELECT count(*) INTO available FROM generate_series(policy.first_hour,policy.last_hour) h
         WHERE (target_day+make_interval(hours=>h)) AT TIME ZONE 'America/Sao_Paulo'>=at_time
           AND NOT ((target_day+make_interval(hours=>h)) AT TIME ZONE 'America/Sao_Paulo'=ANY(occupied));
       IF remaining>available THEN
         slot:=blog_worker.catch_up_publication_slot(at_time,target_day,policy.first_hour,occupied);
         cadence:='catch_up_15m';
       END IF;
     END IF;
     IF slot IS NOT NULL THEN EXIT; END IF;
   END LOOP;
   IF slot IS NULL THEN CONTINUE; END IF;
   p.author_name:='Redação Apogee · produção assistida por IA';
   INSERT INTO blog_worker.publication_receipt(candidate_id,post_id,dossier_revision,dossier_hash,content_hash,comparison_attempt_id,text_attempt_id,image_attempt_id,topic,scheduled_at,publication_day,authorization_reference,cadence)
   VALUES(c.id,p.id,d.revision,d.document_hash,blog_worker.post_content_hash(p),comparison.id,t.id,i.id,selected_topic,slot,target_day,policy.authorization_reference||CASE WHEN cadence='catch_up_15m' THEN '; '||policy.catch_up_authorization_reference ELSE '' END,cadence);
   UPDATE public.blog_post SET status='scheduled',scheduled_at=slot,seo_noindex=false,author_name=p.author_name,revision=revision+1,updated_at=now() WHERE id=p.id;
   UPDATE blog_worker.candidate SET reason='automatic_publication_scheduled' WHERE id=c.id;
   INSERT INTO public.blog_post_event(post_id,actor_name,action) VALUES(p.id,'Automação editorial Apogee','automatic_publication_scheduled');
   INSERT INTO blog_worker.operator_event(actor_id,action,target,detail) VALUES('authorized_hourly_publisher','automatic_publication_scheduled',c.id,jsonb_build_object('post_id',p.id,'scheduled_at',slot,'topic',selected_topic,'percentage',d.assessment->'percentage','human_review',false,'model_calls',0,'authorization',policy.authorization_reference,'cadence',cadence));
   RETURN jsonb_build_object('status','scheduled','post_id',p.id,'scheduled_at',slot,'topic',selected_topic,'cadence',cadence);
 END LOOP;
 RETURN '{"status":"idle","reason":"waiting_for_eligible_article"}'::jsonb;
END $$;

-- News recovery retains the original primary URL and every protected fact.
CREATE OR REPLACE FUNCTION blog_worker.prepare_automatic_research(candidate_key text, document jsonb, source_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; doc jsonb; captured blog_worker.captured_document; source blog_worker.source_catalog; approved jsonb; digest text; previous blog_worker.dossier_version; refreshed boolean:=false; old_context jsonb; new_context jsonb; primary_capture blog_worker.captured_document; format_attempt uuid; prior_count integer;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE id=candidate_key FOR UPDATE;
 IF NOT FOUND OR c.post_id IS NOT NULL OR c.evidence_hash IS DISTINCT FROM source_hash
   OR c.reason IN ('operator_hold','source_changed_after_reservation','retention')
   THEN RETURN false; END IF;
 SELECT * INTO previous FROM blog_worker.dossier_version WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1;
 IF previous.candidate_id IS NOT NULL THEN
  IF c.reason IS NULL OR c.reason NOT IN ('compatibility_below_90','critical_fact_unresolved','independence_unverified')
    OR previous.actor_id NOT IN ('google_assisted','openai_assisted') OR previous.reviewed_by IS NOT NULL
    OR previous.assessment->>'eligible' IS DISTINCT FROM 'false'
    OR previous.source_hash IS DISTINCT FROM c.evidence_hash
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'critical'='true' AND v->>'text' !~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y')
    OR NOT ((SELECT count(*) FROM blog_worker.attempt WHERE candidate_id=c.id)=1 OR
      (SELECT count(*) FROM blog_worker.attempt WHERE candidate_id=c.id)=2 AND
      (SELECT count(*) FROM blog_worker.attempt WHERE candidate_id=c.id AND kind='comparison' AND state='confirmed' AND reason IN ('invalid_structure','invalid_comparison','invalid_claim','invalid_claim_cell','invalid_dossier','duplicate_claim','quote_not_in_document','invalid_quote_reference'))=1 AND
      (SELECT count(*) FROM blog_worker.attempt WHERE candidate_id=c.id AND kind='comparison' AND state='confirmed' AND reason IS NULL)=1)
    OR EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id AND (kind<>'comparison' OR state NOT IN ('confirmed','failed')))
    OR document->>'category' IS DISTINCT FROM previous.document->>'category'
    OR document->'subcategory' IS DISTINCT FROM previous.document->'subcategory'
    OR (c.content_kind='news' AND document->'documents'->0->>'url' IS DISTINCT FROM previous.document->'documents'->0->>'url') THEN RETURN false; END IF;
  SELECT jsonb_agg(jsonb_build_object('url',d->'url','title',d->'title','text',d->'text','published_at',d->'published_at','rights_reference',d->'rights_reference','kind',d->'kind') ORDER BY n)
    INTO old_context FROM jsonb_array_elements(previous.document->'documents') WITH ORDINALITY t(d,n);
  SELECT jsonb_agg(jsonb_build_object('url',d->'url','title',d->'title','text',d->'text','published_at',d->'published_at','rights_reference',d->'rights_reference','kind',d->'kind') ORDER BY n)
    INTO new_context FROM jsonb_array_elements(document->'documents') WITH ORDINALITY t(d,n);
  IF old_context IS NOT DISTINCT FROM new_context THEN RETURN false; END IF;
  document:=jsonb_set(document,'{previous_critical_claims}',(SELECT jsonb_agg(jsonb_build_object('id',v->'id','text',v->'text')) FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'critical'='true' AND v->>'text' !~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y'));
  document:=jsonb_set(document,'{prior_evidence_gaps}',coalesce((SELECT jsonb_agg(v) FROM jsonb_array_elements(previous.document->'claims') v WHERE v->>'text' ~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y'),'[]'::jsonb));
  document:=jsonb_set(document,'{previous_unresolved_claims}',coalesce((
    SELECT jsonb_agg(jsonb_build_object('id',claim->'id','text',claim->'text','critical',claim->'critical'))
    FROM jsonb_array_elements(previous.document->'claims') claim
    WHERE claim->>'text' !~* '^(as evidências fornecidas nos textos|os documentos fornecidos|os textos fornecidos|as fontes fornecidas) não (detalham|mencionam|abordam)\y'
      AND (EXISTS(SELECT 1 FROM jsonb_array_elements(claim->'cells') cell WHERE cell->>'status' IN ('contradicts','unverifiable'))
        OR NOT (SELECT count(DISTINCT prior_doc->>'origin_url')>=2 AND count(DISTINCT prior_doc->>'publisher_key')>=2
          FROM jsonb_array_elements(previous.document->'documents') prior_doc
          WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(claim->'cells') cell WHERE cell->>'document_id'=prior_doc->>'id' AND cell->>'status'='supports')))
  ),'[]'::jsonb));
  SELECT count(*) INTO prior_count FROM blog_worker.attempt WHERE candidate_id=c.id;
  SELECT id INTO format_attempt FROM blog_worker.attempt WHERE candidate_id=c.id AND kind='comparison' AND state='confirmed'
    AND reason IN ('invalid_structure','invalid_comparison','invalid_claim','invalid_claim_cell','invalid_dossier','duplicate_claim','quote_not_in_document','invalid_quote_reference') ORDER BY created_at LIMIT 1;
  document:=jsonb_set(document,'{recovery}',jsonb_build_object('comparison_attempt_id',previous.comparison_attempt_id,'prior_format_attempt_id',format_attempt,'maximum_editorial_attempts',CASE WHEN prior_count=2 AND format_attempt IS NOT NULL THEN 4 ELSE 3 END));
  refreshed:=true;
 ELSIF document ? 'previous_critical_claims' OR document ? 'previous_unresolved_claims' OR document ? 'recovery' THEN RETURN false;
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
     OR (doc->>'excerpt_offset')::integer NOT BETWEEN 0 AND 48000
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
   OR (approved ? 'allowed_urls' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(approved->'allowed_urls') u WHERE u=doc->>'url'))
   OR (approved ? 'publisher' AND approved->>'publisher' IS DISTINCT FROM doc->>'publisher_key')
   OR (CASE WHEN c.content_kind='explainer' THEN doc->>'same_event' IS DISTINCT FROM 'false' OR doc->>'same_subject' IS DISTINCT FROM 'true' ELSE doc->>'same_event' IS DISTINCT FROM 'true' END) OR coalesce(doc->>'kind','') NOT IN ('primary','independent','derivative','context')
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
 CASE WHEN refreshed THEN 'automatic_research_recovery' ELSE 'automatic_research' END,source_hash,CASE WHEN refreshed THEN 'Reapuração automática limitada: evidência textual nova; rejeição e recibos anteriores preservados; exige nova comparação Google e controles da política de publicação' WHEN c.content_kind='explainer' THEN 'Explicativo: pergunta identificada, fontes públicas e datas preservadas; trechos contíguos; exige comparação e controles da política de publicação' ELSE 'Pesquisa automática por DOI/referência explícita; excertos de abertura e snapshots completos preservados; exige comparação e controles da política de publicação' END);
 UPDATE blog_worker.candidate SET status='held',reason='comparison_incomplete',
  artifact=jsonb_set(coalesce(artifact,'{}'::jsonb),'{research}',coalesce(artifact->'research','{}'::jsonb)||jsonb_build_object('stage',CASE WHEN refreshed THEN 'research_refreshed' ELSE 'research_prepared' END,'at',now(),'next_at',null)) WHERE id=c.id;
 INSERT INTO blog_worker.operator_event(actor_id,action,target) VALUES('automatic_research',CASE WHEN refreshed THEN 'research_refreshed' ELSE 'research_prepared' END,c.id);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION blog_worker.prepare_automatic_research(text,jsonb,text) FROM PUBLIC;

-- Official Google documentation redirects to this host. Same publisher.
UPDATE blog_worker.research_reference SET definition=jsonb_set(definition,'{article_hosts}',definition->'article_hosts'||'["docs.cloud.google.com"]'::jsonb)
WHERE id='ARTICLE_PRIMARY_GOOGLE_EDUCATION' AND NOT definition->'article_hosts' ? 'docs.cloud.google.com';
INSERT INTO blog_worker.research_reference(id,definition) SELECT id,definition FROM jsonb_to_recordset($references$[{"id": "ARTICLE_PRIMARY_MDN", "definition": {"reference_id": "PRIMARY_MDN", "enabled": true, "content_approved": true, "url": "https://developer.mozilla.org/", "article_hosts": ["www.developer.mozilla.org", "developer.mozilla.org"], "rights_reference": "Excerto de página pública para apuração e atribuição; sem reprodução integral, acesso restrito ou licença de imagens; respeitar robots.txt"}}, {"id": "ARTICLE_PRIMARY_BDC", "definition": {"reference_id": "PRIMARY_BDC", "enabled": true, "content_approved": true, "url": "https://www.bdc.ca/en/articles-tools", "article_hosts": ["www.bdc.ca", "bdc.ca"], "rights_reference": "Excerto de página pública para apuração e atribuição; sem reprodução integral, acesso restrito ou licença de imagens; respeitar robots.txt"}}]$references$::jsonb) AS r(id text,definition jsonb) ON CONFLICT(id) DO NOTHING;
