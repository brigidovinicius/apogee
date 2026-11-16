-- Disabled until the owner authorizes a dated intake. Runtime cannot enable it,
-- edit its scope, write a receipt, or update a public post directly.
CREATE TABLE blog_worker.publication_policy (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false, starts_on date NOT NULL DEFAULT CURRENT_DATE,
 intake_not_before timestamptz NOT NULL DEFAULT 'infinity',
 first_hour integer NOT NULL DEFAULT 10 CHECK(first_hour BETWEEN 0 AND 23),
 last_hour integer NOT NULL DEFAULT 19 CHECK(last_hour BETWEEN first_hour AND 23),
 authorization_reference text, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT enabled OR (authorization_reference IS NOT NULL AND length(authorization_reference)>=20 AND intake_not_before<>'infinity'::timestamptz))
);
INSERT INTO blog_worker.publication_policy(singleton) VALUES(true);
CREATE TABLE blog_worker.publication_receipt (
 candidate_id text PRIMARY KEY REFERENCES blog_worker.candidate(id),
 post_id integer NOT NULL UNIQUE REFERENCES public.blog_post(id),
 dossier_revision integer NOT NULL, dossier_hash text NOT NULL,
 content_hash text NOT NULL, comparison_attempt_id uuid NOT NULL REFERENCES blog_worker.attempt(id),
 text_attempt_id uuid NOT NULL REFERENCES blog_worker.attempt(id),
 image_attempt_id uuid NOT NULL REFERENCES blog_worker.attempt(id),
 topic text NOT NULL CHECK(topic IN ('technology','ai','business')),
 scheduled_at timestamptz NOT NULL UNIQUE, publication_day date NOT NULL,
 authorization_reference text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION blog_worker.hourly_publication_slot(at_time timestamptz, target_day date, first_hour integer, last_hour integer, occupied timestamptz[]) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
DECLARE h integer; slot timestamptz;
BEGIN
 IF first_hour<0 OR last_hour>23 OR first_hour>last_hour THEN RETURN NULL; END IF;
 FOR h IN first_hour..last_hour LOOP
   slot:=(target_day+make_interval(hours=>h)) AT TIME ZONE 'America/Sao_Paulo';
   IF slot>=at_time AND NOT(slot=ANY(occupied)) THEN RETURN slot; END IF;
 END LOOP;
 RETURN NULL;
END $$;

CREATE FUNCTION blog_worker.schedule_automatic_publication() RETURNS jsonb
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
     OR t.id IS NULL OR t.provider<>'google_subscription' OR t.charged_micro_usd<>0 OR t.quota_used IS NULL OR t.quota_used>t.quota_reserved
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

-- Preserve the human review path. Automatic authorization is a different,
-- immutable receipt tied to the exact article, sources, cover and hourly slot.
CREATE OR REPLACE FUNCTION blog_worker.require_post_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; d blog_worker.dossier_version;
BEGIN
 IF NEW.status NOT IN ('published','scheduled') THEN RETURN NEW; END IF;
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE post_id=NEW.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id AND provider='google_subscription') THEN RETURN NEW; END IF;
 SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1;
 IF c.reason='source_changed_after_reservation' OR coalesce((d.assessment->>'comparison_verified')::boolean,false) IS NOT TRUE OR d.source_hash IS DISTINCT FROM c.evidence_hash OR NOT coalesce((d.assessment->>'eligible')::boolean,false) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='blog_factual_review_required';
 END IF;
 IF EXISTS(SELECT 1 FROM blog_worker.post_review r WHERE r.candidate_id=c.id AND r.post_id=NEW.id AND r.dossier_revision=d.revision AND r.content_hash=blog_worker.post_content_hash(NEW)) THEN RETURN NEW; END IF;
 IF NEW.status='scheduled' AND EXISTS(SELECT 1 FROM blog_worker.publication_receipt r WHERE r.candidate_id=c.id AND r.post_id=NEW.id AND r.dossier_revision=d.revision AND r.dossier_hash=d.document_hash AND r.content_hash=blog_worker.post_content_hash(NEW) AND r.scheduled_at=NEW.scheduled_at AND NOT NEW.seo_noindex AND NEW.published_at IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='blog_factual_review_required';
END $$;
REVOKE ALL ON blog_worker.publication_policy,blog_worker.publication_receipt FROM PUBLIC;
REVOKE ALL ON FUNCTION blog_worker.schedule_automatic_publication() FROM PUBLIC;
DO $$ DECLARE role_name text; BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('apogee_blog_worker','blog_runtime') LOOP
   EXECUTE format('GRANT SELECT ON blog_worker.publication_policy,blog_worker.publication_receipt TO %I',role_name);
   EXECUTE format('GRANT EXECUTE ON FUNCTION blog_worker.schedule_automatic_publication() TO %I',role_name);
 END LOOP;
END $$;
