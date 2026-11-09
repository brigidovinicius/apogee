ALTER TABLE blog_worker.attempt ADD COLUMN kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image'));
ALTER TABLE blog_worker.attempt DROP CONSTRAINT attempt_candidate_id_ordinal_key;
ALTER TABLE blog_worker.attempt ADD UNIQUE (candidate_id,kind,ordinal);
CREATE TABLE blog_worker.image_job (
 candidate_id text PRIMARY KEY REFERENCES blog_worker.candidate(id), post_id integer NOT NULL REFERENCES public.blog_post(id),
 prompt text NOT NULL CHECK(length(prompt) BETWEEN 20 AND 2500), alt text NOT NULL CHECK(length(alt) BETWEEN 3 AND 160),
 caption text NOT NULL CHECK(length(caption) BETWEEN 10 AND 300), expected_revision integer NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','reserved','completed','review','held')),
 image bytea CHECK(octet_length(image) BETWEEN 1 AND 2097152), media_id text, reason text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE blog_worker.source_catalog (id text PRIMARY KEY, definition jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE blog_worker.operator_event (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_id text NOT NULL, action text NOT NULL, target text, detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE blog_worker.command (
 id uuid PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('collect','generate')), candidate_id text REFERENCES blog_worker.candidate(id) ON DELETE SET NULL,
 actor_id text NOT NULL, state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','blocked')),
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz
);
CREATE UNIQUE INDEX blog_worker_one_queued_command ON blog_worker.command ((true)) WHERE state IN ('queued','running');
ALTER TABLE blog_worker.control ADD COLUMN snapshot jsonb;
ALTER TABLE blog_worker.control ADD COLUMN heartbeat_at timestamptz;

CREATE FUNCTION blog_worker.queue_cover(candidate_key text, prompt_text text, alt_text text, caption_text text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.blog_post;
BEGIN
 SELECT b.* INTO p FROM public.blog_post b JOIN blog_worker.candidate c ON c.post_id=b.id WHERE c.id=candidate_key FOR UPDATE OF b;
 IF NOT FOUND OR p.status<>'draft' THEN RETURN false; END IF;
 INSERT INTO blog_worker.image_job(candidate_id,post_id,prompt,alt,caption,expected_revision)
 VALUES(candidate_key,p.id,prompt_text,alt_text,caption_text,p.revision) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;

CREATE FUNCTION blog_worker.import_cover(candidate_key text, media_key text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE job blog_worker.image_job; p public.blog_post;
BEGIN
 SELECT * INTO job FROM blog_worker.image_job WHERE candidate_id=candidate_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'cover not importable'; END IF;
 IF job.media_id IS NOT NULL THEN RETURN job.media_id; END IF;
 IF job.image IS NULL OR job.state NOT IN ('review','completed') THEN RAISE EXCEPTION 'cover not importable'; END IF;
 SELECT * INTO p FROM public.blog_post WHERE id=job.post_id FOR UPDATE;
 IF p.status<>'draft' OR p.revision<>job.expected_revision THEN RETURN NULL; END IF;
 INSERT INTO public.blog_media(id,post_id,alt,caption,width,height,image) VALUES(media_key,p.id,job.alt,job.caption,1536,1024,job.image);
 UPDATE public.blog_post SET cover_media_id=media_key,revision=revision+1,updated_at=now() WHERE id=p.id;
 INSERT INTO public.blog_post_event(post_id,actor_name,action) VALUES(p.id,'Worker do blog','ai_cover_requires_review');
 UPDATE blog_worker.image_job SET media_id=media_key,image=NULL,state='completed',reason=NULL,updated_at=now() WHERE candidate_id=candidate_key;
 RETURN media_key;
END $$;
REVOKE ALL ON FUNCTION blog_worker.queue_cover(text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION blog_worker.import_cover(text,text) FROM PUBLIC;
