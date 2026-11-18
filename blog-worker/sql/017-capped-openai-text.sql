-- Optional API text lane. Comparisons and credited covers remain Google.
CREATE TABLE blog_worker.openai_circuit (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 blocked boolean NOT NULL DEFAULT false, reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO blog_worker.openai_circuit(singleton) VALUES(true);
CREATE FUNCTION blog_worker.block_openai(block_reason text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
 UPDATE blog_worker.openai_circuit SET blocked=true,reason=left(block_reason,80),updated_at=now() WHERE singleton
$$;
REVOKE ALL ON blog_worker.openai_circuit FROM PUBLIC;
REVOKE ALL ON FUNCTION blog_worker.block_openai(text) FROM PUBLIC;
ALTER TABLE blog_worker.attempt DROP CONSTRAINT attempt_ordinal_check;
-- A documented rejection without generation may precede two text attempts.
-- It keeps its own receipt/ordinal but does not consume an editorial attempt.
ALTER TABLE blog_worker.attempt ADD CONSTRAINT attempt_ordinal_check CHECK(ordinal BETWEEN 1 AND CASE WHEN kind IN ('comparison','text') THEN 3 ELSE 2 END);

CREATE FUNCTION blog_worker.valid_text_receipt(attempt_key uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a blog_worker.attempt; b blog_worker.benefit; months integer; cap bigint;
BEGIN
 SELECT * INTO a FROM blog_worker.attempt WHERE id=attempt_key;
 IF a.id IS NULL OR a.kind<>'text' OR a.state<>'confirmed' OR a.reason IS NOT NULL OR a.finished_at IS NULL THEN RETURN false; END IF;
 IF a.provider='google_subscription' THEN
   RETURN a.charged_micro_usd=0 AND a.quota_used IS NOT NULL AND a.quota_used<=a.quota_reserved;
 END IF;
 IF a.provider<>'openai_api' OR a.policy->>'editorial_pipeline' IS DISTINCT FROM 'google_multisource_v1'
   OR a.policy->>'model_id' IS DISTINCT FROM 'gpt-6-luna' OR a.price->>'model' IS DISTINCT FROM 'gpt-6-luna'
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
REVOKE ALL ON FUNCTION blog_worker.valid_text_receipt(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION blog_worker.import_draft(candidate_key text,payload jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d blog_worker.dossier_version; a blog_worker.attempt;
BEGIN
 SELECT * INTO a FROM blog_worker.attempt WHERE candidate_id=candidate_key AND kind='text' ORDER BY created_at DESC LIMIT 1;
 IF a.provider='google_subscription' OR a.policy->>'editorial_pipeline'='google_multisource_v1' THEN
   IF blog_worker.valid_text_receipt(a.id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'verified text receipt required'; END IF;
   SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=candidate_key ORDER BY revision DESC LIMIT 1;
   IF coalesce((d.assessment->>'comparison_verified')::boolean,false) IS NOT TRUE OR d.revision IS DISTINCT FROM a.dossier_revision OR d.document_hash IS DISTINCT FROM a.dossier_hash
      OR d.source_hash IS DISTINCT FROM (SELECT evidence_hash FROM blog_worker.candidate WHERE id=candidate_key)
      OR coalesce((d.assessment->>'eligible')::boolean,false) IS NOT TRUE THEN
     RAISE EXCEPTION 'verified corroboration required';
   END IF;
 END IF;
 RETURN blog_worker.import_draft_legacy(candidate_key,payload);
END $$;

CREATE OR REPLACE FUNCTION blog_worker.schedule_automatic_publication() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE policy blog_worker.publication_policy; c blog_worker.candidate; p public.blog_post;
 d blog_worker.dossier_version; j blog_worker.image_job; m public.blog_media;
 t blog_worker.attempt; i blog_worker.attempt; comparison blog_worker.attempt;
 generated jsonb; selected_topic text; topic_cap integer; at_time timestamptz:=clock_timestamp();
 target_day date; slot timestamptz; occupied timestamptz[]; offset_day integer;
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
     OR comparison.provider<>'google_subscription' OR comparison.charged_micro_usd<>0 OR comparison.finished_at<at_time-interval '48 hours'
     OR blog_worker.valid_text_receipt(t.id) IS DISTINCT FROM true
     OR t.dossier_revision IS DISTINCT FROM d.revision OR t.dossier_hash IS DISTINCT FROM d.document_hash
     OR t.day<policy.starts_on OR t.created_at<policy.intake_not_before OR t.finished_at<at_time-interval '48 hours'
     OR i.id IS NULL OR i.provider<>'google_subscription' OR i.charged_micro_usd<>0 OR i.quota_used IS NULL OR i.quota_used>i.quota_reserved
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
     slot:=blog_worker.hourly_publication_slot(at_time,target_day,policy.first_hour,policy.last_hour,occupied);
     IF slot IS NOT NULL THEN EXIT; END IF;
   END LOOP;
   IF slot IS NULL THEN CONTINUE; END IF;
   p.author_name:='Redação Apogee · produção assistida por IA';
   INSERT INTO blog_worker.publication_receipt(candidate_id,post_id,dossier_revision,dossier_hash,content_hash,comparison_attempt_id,text_attempt_id,image_attempt_id,topic,scheduled_at,publication_day,authorization_reference)
   VALUES(c.id,p.id,d.revision,d.document_hash,blog_worker.post_content_hash(p),comparison.id,t.id,i.id,selected_topic,slot,target_day,policy.authorization_reference);
   UPDATE public.blog_post SET status='scheduled',scheduled_at=slot,seo_noindex=false,author_name=p.author_name,revision=revision+1,updated_at=now() WHERE id=p.id;
   UPDATE blog_worker.candidate SET reason='automatic_publication_scheduled' WHERE id=c.id;
   INSERT INTO public.blog_post_event(post_id,actor_name,action) VALUES(p.id,'Automação editorial Apogee','automatic_publication_scheduled');
   INSERT INTO blog_worker.operator_event(actor_id,action,target,detail) VALUES('authorized_hourly_publisher','automatic_publication_scheduled',c.id,jsonb_build_object('post_id',p.id,'scheduled_at',slot,'topic',selected_topic,'percentage',d.assessment->'percentage','human_review',false,'model_calls',0,'authorization',policy.authorization_reference));
   RETURN jsonb_build_object('status','scheduled','post_id',p.id,'scheduled_at',slot,'topic',selected_topic);
 END LOOP;
 RETURN '{"status":"idle","reason":"waiting_for_eligible_article"}'::jsonb;
END $$;


-- Only block/observe this optional lane. Runtime cannot grant credit, change a
-- budget, enable recharge or reopen the circuit.
DO $$ DECLARE role_name text; BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('apogee_blog_worker','blog_runtime') LOOP
   EXECUTE format('GRANT SELECT ON blog_worker.openai_circuit TO %I',role_name);
   EXECUTE format('GRANT EXECUTE ON FUNCTION blog_worker.block_openai(text) TO %I',role_name);
 END LOOP;
END $$;
