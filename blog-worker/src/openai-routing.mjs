import {fail,validatePolicy} from './policy.mjs';

export const DEFAULT_OPENAI_CONFIG=Object.freeze({schema_version:1,enabled:false,model_id:'gpt-6-luna',
  cycle_budget_micro_usd_cap:5000000,daily_budget_micro_usd_cap:250000,article_budget_micro_usd_cap:50000,
  auto_recharge_enabled:false,paid_balance_fallback_enabled:false});
export function validateOpenAIConfig(value){
  if(!value||typeof value.enabled!=='boolean'||value.schema_version!==1
    ||value.model_id!=='gpt-6-luna'||value.auto_recharge_enabled!==false||value.paid_balance_fallback_enabled!==false
    ||value.cycle_budget_micro_usd_cap!==5000000||value.daily_budget_micro_usd_cap!==250000
    ||value.article_budget_micro_usd_cap!==50000)fail('openai_config_invalid');
  return value;
}
export function apiTextPolicy(editorial,config){
  validateOpenAIConfig(config);if(!config.enabled)fail('openai_disabled');
  return validatePolicy({...editorial,schema_version:1,provider:'openai_api',policy_id:'apogee-blog-free-credit-text-v1',generation_enabled:true,
    allowed_balance_type:'included_subscription_benefit_only',verified_grant_required:true,google_consumer_auth_worker_enabled:false,
    automatic_image_generation_enabled:false,block_without_approved_price_catalog:true,block_without_valid_benefit:true,
    model_id:config.model_id,editorial_pipeline:'google_multisource_v1',editorial_policy:editorial,
    editorial_focus:editorial.editorial_focus,input_counting_mode:'local_byte_bound',operator_commands_only:false,
    new_drafts_per_day_cap:editorial.new_drafts_per_day_cap,new_drafts_per_week_cap:editorial.new_drafts_per_week_cap,
    max_primary_evidence_documents:editorial.max_primary_evidence_documents,
    max_provider_attempts_per_article_including_repairs:editorial.max_provider_attempts_per_article_including_repairs,
    input_tokens_cap_including_overhead:12000,cycle_budget_micro_usd_cap:config.cycle_budget_micro_usd_cap,
    daily_budget_micro_usd_cap:config.daily_budget_micro_usd_cap,
    article_budget_micro_usd_cap_including_all_attempts:config.article_budget_micro_usd_cap});
}

export const API_FALLBACK_REASONS=new Set(['openai_disabled','openai_circuit_open','credentials_missing','benefit_unverified',
  'free_credit_isolation_required','credit_envelope_unverified','free_credit_exhausted','free_credit_reservation_required',
  'price_missing','price_unapproved_or_expired','cycle_budget','daily_budget','article_budget','input_limit',
  'attempt_limit','openai_credit_limit','reservation_expired']);
