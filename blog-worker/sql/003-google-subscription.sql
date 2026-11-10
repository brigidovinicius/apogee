-- Preserve the historical API ledger; subscription attempts carry no monetary budget.
ALTER TABLE blog_worker.attempt ALTER COLUMN benefit_id DROP NOT NULL;
ALTER TABLE blog_worker.attempt ADD COLUMN provider text NOT NULL DEFAULT 'openai_api' CHECK(provider IN ('openai_api','google_subscription'));
ALTER TABLE blog_worker.attempt ADD COLUMN quota_reserved bigint NOT NULL DEFAULT 0 CHECK(quota_reserved>=0);
ALTER TABLE blog_worker.attempt ADD COLUMN quota_used bigint CHECK(quota_used>=0);
ALTER TABLE blog_worker.attempt ADD CONSTRAINT attempt_billing_scope CHECK (
 (provider='openai_api' AND benefit_id IS NOT NULL AND quota_reserved=0) OR
 (provider='google_subscription' AND benefit_id IS NULL AND reserved_micro_usd=0 AND coalesce(charged_micro_usd,0)=0)
);
CREATE TABLE blog_worker.subscription (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), account_email text NOT NULL,
 plan text NOT NULL CHECK(plan='google_ai_pro'), verified_at timestamptz NOT NULL, valid_until timestamptz NOT NULL,
 attestation jsonb NOT NULL, CHECK(valid_until>verified_at)
);
