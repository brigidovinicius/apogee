-- The owner's original plan attestation is immutable to runtime. This separate
-- short lease proves current access through the already-approved native profile,
-- not payment, a new subscription or editorial approval.
CREATE TABLE blog_worker.google_access (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 binding_hash text, client_sha256 text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','checking','valid','failed')),
 claim_id uuid, claim_until timestamptz,
 checked_at timestamptz, succeeded_at timestamptz, valid_until timestamptz,
 next_check_at timestamptz NOT NULL DEFAULT now(),
 minimum_fraction double precision CHECK(minimum_fraction BETWEEN 0 AND 1),
 failures integer NOT NULL DEFAULT 0 CHECK(failures BETWEEN 0 AND 20),
 reason text, receipt jsonb
);

CREATE FUNCTION blog_worker.claim_google_access(expected_email text, client_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE s blog_worker.subscription; a blog_worker.google_access; binding text; moment timestamptz:=clock_timestamp(); claim uuid;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO s FROM blog_worker.subscription WHERE singleton=true;
 IF s.account_email IS DISTINCT FROM expected_email OR s.plan IS DISTINCT FROM 'google_ai_pro'
   OR s.attestation->>'account_email' IS DISTINCT FROM expected_email
   OR s.attestation->>'auth_method' IS DISTINCT FROM 'official_google_oauth'
   OR s.attestation->>'use_g1_credits' IS DISTINCT FROM 'false'
   OR s.verified_at>moment OR s.valid_until<=s.verified_at OR s.valid_until-s.verified_at>interval '24 hours'
   OR coalesce(client_hash,'') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'google_access_binding_changed'; END IF;
 binding:=encode(sha256(convert_to(blog_worker.canonical_json(s.attestation),'UTF8')),'hex');
 INSERT INTO blog_worker.google_access(singleton) VALUES(true) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM blog_worker.google_access WHERE singleton=true FOR UPDATE;
 IF a.claim_until>moment THEN RETURN jsonb_build_object('status','blocked','reason','google_access_check_in_progress'); END IF;
 IF a.binding_hash=binding AND a.client_sha256=client_hash AND a.next_check_at>moment THEN
  IF a.state='valid' AND a.valid_until>moment+interval '3 minutes' THEN
   RETURN jsonb_build_object('status','valid','valid_until',a.valid_until,'next_check_at',a.next_check_at);
  END IF;
  RETURN jsonb_build_object('status','blocked','reason',coalesce(a.reason,'google_access_unverified'),'next_check_at',a.next_check_at);
 END IF;
 IF EXISTS(SELECT 1 FROM blog_worker.attempt WHERE state='reserved') THEN RETURN jsonb_build_object('status','blocked','reason','request_pending'); END IF;
 claim:=gen_random_uuid();
 UPDATE blog_worker.google_access SET binding_hash=binding,client_sha256=client_hash,state='checking',
   claim_id=claim,claim_until=moment+interval '90 seconds',checked_at=moment WHERE singleton=true;
 RETURN jsonb_build_object('status','claimed','claim_id',claim);
END $$;

CREATE FUNCTION blog_worker.settle_google_access(claim_key uuid, result jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE a blog_worker.google_access; s blog_worker.subscription; moment timestamptz:=clock_timestamp(); fraction double precision; failure_reason text; bucket jsonb;
BEGIN
 PERFORM singleton FROM blog_worker.control WHERE singleton=true FOR UPDATE;
 SELECT * INTO a FROM blog_worker.google_access WHERE singleton=true FOR UPDATE;
 SELECT * INTO s FROM blog_worker.subscription WHERE singleton=true;
 IF a.claim_id IS DISTINCT FROM claim_key OR a.state IS DISTINCT FROM 'checking' OR a.claim_until<=moment
   OR a.binding_hash IS DISTINCT FROM encode(sha256(convert_to(blog_worker.canonical_json(s.attestation),'UTF8')),'hex') THEN
  RETURN jsonb_build_object('status','blocked','reason','google_access_stale_check');
 END IF;
 IF octet_length(result::text)>8192 OR jsonb_typeof(result->'ok') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'invalid_access_receipt'; END IF;
 IF result->>'ok'='true' THEN
  IF result->>'command' IS DISTINCT FROM 'usage' OR result->'num_turns' IS DISTINCT FROM '0'::jsonb
   OR result->'use_g1_credits' IS DISTINCT FROM 'false'::jsonb OR result->>'client_sha256' IS DISTINCT FROM a.client_sha256
   OR result->'model_tokens' IS DISTINCT FROM '0'::jsonb
   OR result->'quota'->>'name' IS DISTINCT FROM 'Gemini Models'
   OR jsonb_typeof(result->'quota'->'buckets') IS DISTINCT FROM 'array'
   OR jsonb_array_length(result->'quota'->'buckets')<>2 THEN RAISE EXCEPTION 'invalid_access_receipt'; END IF;
  FOR bucket IN SELECT value FROM jsonb_array_elements(result->'quota'->'buckets') LOOP
   IF coalesce(bucket->>'window','') NOT IN ('weekly','5h') OR jsonb_typeof(bucket->'remaining_fraction') IS DISTINCT FROM 'number'
    OR (bucket->>'remaining_fraction')::double precision NOT BETWEEN 0 AND 1
    OR (bucket->>'reset_time')::timestamptz<=moment OR (bucket->>'reset_time')::timestamptz>moment+interval '8 days'
    OR bucket->>'reset_time' IS NULL THEN RAISE EXCEPTION 'invalid_access_receipt'; END IF;
  END LOOP;
  IF (SELECT count(distinct v->>'window') FROM jsonb_array_elements(result->'quota'->'buckets') v)<>2 THEN RAISE EXCEPTION 'invalid_access_receipt'; END IF;
  SELECT min((v->>'remaining_fraction')::double precision) INTO fraction FROM jsonb_array_elements(result->'quota'->'buckets') v;
  UPDATE blog_worker.google_access SET state='valid',claim_id=null,claim_until=null,succeeded_at=moment,
   valid_until=moment+interval '6 hours',next_check_at=moment+interval '1 hour',minimum_fraction=fraction,failures=0,reason=null,receipt=result WHERE singleton=true;
  INSERT INTO blog_worker.operator_event(actor_id,action,detail) VALUES('google_access_verifier','google_access_verified',
   jsonb_build_object('binding_hash',a.binding_hash,'client_sha256',a.client_sha256,'model_turns',0,'model_tokens',0,'paid_api',false,'use_g1_credits',false,'minimum_fraction',fraction,'valid_until',moment+interval '6 hours','billing_plan_reverified',false));
  RETURN jsonb_build_object('status','valid','valid_until',moment+interval '6 hours','next_check_at',moment+interval '1 hour');
 END IF;
 failure_reason:=result->>'reason';
 IF coalesce(failure_reason,'') NOT IN ('google_auth_required','google_client_changed','google_client_unavailable','google_quota_unavailable','google_access_unavailable') THEN failure_reason:='google_access_unavailable'; END IF;
 UPDATE blog_worker.google_access SET state='failed',claim_id=null,claim_until=null,valid_until=null,
  next_check_at=moment+least(3600,300*power(2,least(a.failures,4)))*interval '1 second',failures=least(20,a.failures+1),reason=failure_reason,receipt=jsonb_build_object('ok',false,'reason',failure_reason) WHERE singleton=true;
 INSERT INTO blog_worker.operator_event(actor_id,action,detail) VALUES('google_access_verifier','google_access_check_failed',jsonb_build_object('reason',failure_reason,'model_turns',0,'paid_api',false));
 RETURN jsonb_build_object('status','blocked','reason',failure_reason);
END $$;
REVOKE ALL ON FUNCTION blog_worker.claim_google_access(text,text),blog_worker.settle_google_access(uuid,jsonb) FROM PUBLIC;
