-- Immutable editorial history. Runtime can append only an assisted comparison
-- through the bounded function below; only authenticated editors record final reviews.
CREATE TABLE blog_worker.dossier_version (
 candidate_id text NOT NULL REFERENCES blog_worker.candidate(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), document jsonb NOT NULL,
 document_hash text NOT NULL CHECK(document_hash ~ '^[a-f0-9]{64}$'), assessment jsonb NOT NULL,
 actor_id text NOT NULL, reviewed_by text, reviewed_at timestamptz,
 source_hash text NOT NULL,
 change_reason text NOT NULL CHECK(length(change_reason) BETWEEN 8 AND 1000),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(candidate_id,revision),
 CHECK((reviewed_by IS NULL AND reviewed_at IS NULL) OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE TABLE blog_worker.captured_document (
 id text PRIMARY KEY, candidate_id text NOT NULL REFERENCES blog_worker.candidate(id) ON DELETE CASCADE,
 source_id text NOT NULL, url text NOT NULL, snapshot_hash text NOT NULL, document jsonb NOT NULL,
 captured_at timestamptz NOT NULL DEFAULT now(), UNIQUE(url,snapshot_hash)
);
CREATE INDEX blog_worker_captured_by_event ON blog_worker.captured_document(candidate_id,captured_at);
ALTER TABLE blog_worker.attempt DROP CONSTRAINT attempt_kind_check;
ALTER TABLE blog_worker.attempt ADD CONSTRAINT attempt_kind_check CHECK(kind IN ('text','image','comparison'));
ALTER TABLE blog_worker.attempt ADD COLUMN dossier_revision integer;
ALTER TABLE blog_worker.attempt ADD COLUMN dossier_hash text;
ALTER TABLE blog_worker.command DROP CONSTRAINT command_kind_check;
ALTER TABLE blog_worker.command ADD CONSTRAINT command_kind_check CHECK(kind IN ('collect','generate','compare'));

ALTER TABLE blog_worker.dossier_version ADD COLUMN comparison_attempt_id uuid UNIQUE REFERENCES blog_worker.attempt(id);

-- Same stable JSON encoding used by the shared editorial contract (fixed object keys).
CREATE FUNCTION blog_worker.canonical_json(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE STRICT SET search_path=pg_catalog AS $$
DECLARE result text;
BEGIN
 CASE jsonb_typeof(v)
 WHEN 'object' THEN
   SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||blog_worker.canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(v);
 WHEN 'array' THEN
   SELECT '['||coalesce(string_agg(blog_worker.canonical_json(value),',' ORDER BY ordinality),'')||']' INTO result FROM jsonb_array_elements(v) WITH ORDINALITY;
 ELSE result:=v::text;
 END CASE;
 RETURN result;
END $$;

CREATE FUNCTION blog_worker.record_assisted_comparison(candidate_key text, attempt_key uuid, claims jsonb, assessment jsonb) RETURNS integer
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
 IF jsonb_typeof(claims) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_comparison'; END IF;
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
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(d.document->'documents') x WHERE x->>'same_event' IS DISTINCT FROM 'true') THEN blockers:=array_append(blockers,'event_unverified'); END IF;
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

-- Enforce the exact verified comparison at the private draft-only boundary too.
ALTER FUNCTION blog_worker.import_draft(text,jsonb) RENAME TO import_draft_legacy;
CREATE FUNCTION blog_worker.import_draft(candidate_key text,payload jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE d blog_worker.dossier_version; a blog_worker.attempt;
BEGIN
 SELECT * INTO a FROM blog_worker.attempt WHERE candidate_id=candidate_key AND kind='text' ORDER BY created_at DESC LIMIT 1;
 IF a.provider='google_subscription' THEN
   SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=candidate_key ORDER BY revision DESC LIMIT 1;
   IF coalesce((d.assessment->>'comparison_verified')::boolean,false) IS NOT TRUE OR d.revision IS DISTINCT FROM a.dossier_revision OR d.document_hash IS DISTINCT FROM a.dossier_hash
      OR d.source_hash IS DISTINCT FROM (SELECT evidence_hash FROM blog_worker.candidate WHERE id=candidate_key)
      OR coalesce((d.assessment->>'eligible')::boolean,false) IS NOT TRUE THEN
     RAISE EXCEPTION 'verified corroboration required';
   END IF;
 END IF;
 RETURN blog_worker.import_draft_legacy(candidate_key,payload);
END $$;
CREATE TABLE blog_worker.post_review (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, candidate_id text NOT NULL REFERENCES blog_worker.candidate(id),
 post_id integer NOT NULL REFERENCES public.blog_post(id), dossier_revision integer NOT NULL,
 content_hash text NOT NULL, actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION blog_worker.post_content_hash(p public.blog_post) RETURNS text
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT encode(sha256(convert_to(jsonb_build_array(p.title,p.excerpt,p.body,p.category,p.seo_title,p.seo_description,p.author_name,p.video_url,p.cover_media_id,
   (SELECT jsonb_build_array(m.alt,m.caption,encode(sha256(m.image),'hex')) FROM public.blog_media m WHERE m.id=p.cover_media_id))::text,'UTF8')),'hex')
$$;
CREATE FUNCTION blog_worker.require_post_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c blog_worker.candidate; d blog_worker.dossier_version;
BEGIN
 IF NEW.status NOT IN ('published','scheduled') THEN RETURN NEW; END IF;
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO c FROM blog_worker.candidate WHERE post_id=NEW.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM blog_worker.attempt WHERE candidate_id=c.id AND provider='google_subscription') THEN RETURN NEW; END IF;
 SELECT * INTO d FROM blog_worker.dossier_version WHERE candidate_id=c.id ORDER BY revision DESC LIMIT 1;
 IF c.reason='source_changed_after_reservation' OR coalesce((d.assessment->>'comparison_verified')::boolean,false) IS NOT TRUE OR d.source_hash IS DISTINCT FROM c.evidence_hash OR NOT coalesce((d.assessment->>'eligible')::boolean,false)
   OR NOT EXISTS(SELECT 1 FROM blog_worker.post_review r WHERE r.candidate_id=c.id AND r.post_id=NEW.id
     AND r.dossier_revision=d.revision AND r.content_hash=blog_worker.post_content_hash(NEW)) THEN
   RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='blog_factual_review_required';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER blog_worker_review_before_publish BEFORE INSERT OR UPDATE ON public.blog_post
FOR EACH ROW EXECUTE FUNCTION blog_worker.require_post_review();
REVOKE ALL ON FUNCTION blog_worker.import_draft_legacy(text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION blog_worker.import_draft(text,jsonb) FROM PUBLIC;
-- The legacy inner function must never remain directly executable by runtime.
DO $$ DECLARE role_name text; BEGIN
 FOR role_name IN SELECT rolname FROM pg_roles WHERE rolname IN ('apogee_blog_worker','blog_runtime') LOOP
   EXECUTE format('REVOKE ALL ON FUNCTION blog_worker.import_draft_legacy(text,jsonb) FROM %I',role_name);
 END LOOP;
END $$;

CREATE TABLE blog_worker.quota_observation (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 stage text NOT NULL CHECK(stage IN ('before','after')),
 minimum_fraction double precision NOT NULL CHECK(minimum_fraction BETWEEN 0 AND 1),
 created_at timestamptz NOT NULL DEFAULT now()
);
