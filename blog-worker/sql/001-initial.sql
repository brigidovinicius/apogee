CREATE SCHEMA blog_worker;
CREATE TABLE blog_worker.migration (version integer PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE blog_worker.control (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), paused boolean NOT NULL DEFAULT false,
 reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO blog_worker.control(singleton) VALUES (true);
CREATE TABLE blog_worker.benefit (
 id text PRIMARY KEY, organization_id text NOT NULL, project_id text NOT NULL,
 starts_at timestamptz NOT NULL, expires_at timestamptz NOT NULL CHECK (expires_at > starts_at),
 amount_micro_usd bigint NOT NULL CHECK (amount_micro_usd > 0),
 remaining_micro_usd bigint NOT NULL CHECK (remaining_micro_usd BETWEEN 0 AND amount_micro_usd),
 verified_at timestamptz NOT NULL, revoked_at timestamptz, attestation jsonb NOT NULL
);
CREATE TABLE blog_worker.source_state (
 id text PRIMARY KEY, next_due_at timestamptz NOT NULL DEFAULT now(), etag text, last_modified text,
 last_collected_at timestamptz, last_result text, failures integer NOT NULL DEFAULT 0 CHECK (failures BETWEEN 0 AND 20)
);
CREATE TABLE blog_worker.candidate (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'), source_id text NOT NULL, guid text NOT NULL,
 url text NOT NULL UNIQUE, event_key text NOT NULL UNIQUE, title text NOT NULL,
 editoria text NOT NULL CHECK (editoria IN ('ia','startups','ciencia-espaco','tecnologia','oportunidades')),
 score integer NOT NULL, published_at timestamptz NOT NULL, evidence jsonb NOT NULL, evidence_hash text NOT NULL,
 status text NOT NULL CHECK (status IN ('discovered','ready','held','draft')),
 first_attempt_day date, first_attempt_week date, post_id integer REFERENCES public.blog_post(id) ON DELETE SET NULL,
 artifact jsonb, reason text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (source_id,guid)
);
CREATE INDEX blog_worker_candidate_ready ON blog_worker.candidate(status,published_at);
CREATE TABLE blog_worker.attempt (
 id uuid PRIMARY KEY, candidate_id text NOT NULL REFERENCES blog_worker.candidate(id),
 benefit_id text NOT NULL REFERENCES blog_worker.benefit(id), ordinal integer NOT NULL CHECK (ordinal BETWEEN 1 AND 2),
 cache_key text NOT NULL, request_hash text NOT NULL, price jsonb NOT NULL, policy jsonb NOT NULL,
 day date NOT NULL, week date NOT NULL, state text NOT NULL CHECK (state IN ('reserved','confirmed','unknown')),
 reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd >= 0),
 charged_micro_usd bigint CHECK (charged_micro_usd >= 0), usage jsonb, reason text,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 UNIQUE (candidate_id,ordinal),
 CHECK ((state='confirmed' AND charged_micro_usd IS NOT NULL) OR (state<>'confirmed' AND charged_micro_usd IS NULL))
);
CREATE UNIQUE INDEX blog_worker_one_request ON blog_worker.attempt ((true)) WHERE state='reserved';
CREATE INDEX blog_worker_attempt_budget ON blog_worker.attempt(benefit_id,day);
CREATE INDEX blog_worker_attempt_cache ON blog_worker.attempt(cache_key);

-- Runtime gets EXECUTE only, never INSERT/UPDATE on public.blog_post. This function can only create drafts.
CREATE FUNCTION blog_worker.import_draft(candidate_key text, payload jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE target integer; candidate_status text;
BEGIN
 SELECT post_id,status INTO target,candidate_status FROM blog_worker.candidate WHERE id=candidate_key FOR UPDATE;
 IF NOT FOUND OR candidate_status NOT IN ('ready','draft') THEN RAISE EXCEPTION 'candidate not importable'; END IF;
 IF target IS NOT NULL THEN RETURN target; END IF;
 INSERT INTO public.blog_post(slug,title,excerpt,body,category,status,author_name,seo_title,seo_description,seo_noindex,published_at,scheduled_at)
 VALUES(payload->>'slug',payload->>'title',payload->>'excerpt',payload->>'body',payload->>'category','draft',
 'Redação Apogee · rascunho assistido',payload->>'seo_title',payload->>'seo_description',true,NULL,NULL) RETURNING id INTO target;
 INSERT INTO public.blog_post_event(post_id,actor_name,action)
 VALUES(target,'Worker do blog','automated_draft_requires_review');
 UPDATE blog_worker.candidate SET status='draft',post_id=target,reason='human_review_required' WHERE id=candidate_key;
 RETURN target;
END $$;
REVOKE ALL ON FUNCTION blog_worker.import_draft(text,jsonb) FROM PUBLIC;
REVOKE ALL ON SCHEMA blog_worker FROM PUBLIC;
