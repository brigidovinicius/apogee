import {fail,validatePolicy} from './policy.mjs';

export const DEFAULT_OPENAI_CONFIG=Object.freeze({schema_version:1,enabled:false,model_id:'gpt-6-luna',
  cycle_budget_micro_usd_cap:5000000,daily_budget_micro_usd_cap:250000,article_budget_micro_usd_cap:50000,
  auto_recharge_enabled:false,paid_balance_fallback_enabled:false});
export function validateOpenAIConfig(value){
  if(!value||typeof value.enabled!=='boolean'||![1,2].includes(value.schema_version)
    ||value.model_id!=='gpt-6-luna'||value.auto_recharge_enabled!==false||value.paid_balance_fallback_enabled!==false
    ||value.cycle_budget_micro_usd_cap!==5000000||value.daily_budget_micro_usd_cap!==250000
    ||value.article_budget_micro_usd_cap!==50000)fail('openai_config_invalid');
  if(value.schema_version===2&&(typeof value.comparison_enabled!=='boolean'||typeof value.image_enabled!=='boolean'
    ||value.image_model_id!=='gpt-image-2.5-flare-2026-09-08'||value.image_quality!=='low'))fail('openai_config_invalid');
  return value;
}
export function apiOperationPolicy(editorial,config,kind='text'){
  validateOpenAIConfig(config);if(!config.enabled)fail('openai_disabled');
  if(!['text','comparison','image'].includes(kind)||kind!=='text'&&(config.schema_version!==2||!config[kind==='image'?'image_enabled':'comparison_enabled']))fail('openai_operation_disabled');
  return validatePolicy({...editorial,schema_version:1,provider:'openai_api',policy_id:'apogee-blog-free-credit-text-v1',generation_enabled:true,
    allowed_balance_type:'included_subscription_benefit_only',verified_grant_required:true,google_consumer_auth_worker_enabled:false,
    automatic_image_generation_enabled:kind==='image',block_without_approved_price_catalog:true,block_without_valid_benefit:true,
    model_id:config.model_id,editorial_pipeline:'google_multisource_v1',editorial_policy:editorial,
    editorial_focus:editorial.editorial_focus,input_counting_mode:'local_byte_bound',operator_commands_only:false,
    new_drafts_per_day_cap:editorial.new_drafts_per_day_cap,new_drafts_per_week_cap:editorial.new_drafts_per_week_cap,
    max_primary_evidence_documents:editorial.max_primary_evidence_documents,
    max_provider_attempts_per_article_including_repairs:editorial.max_provider_attempts_per_article_including_repairs,
    ...(config.schema_version===2?{api_operation:kind}:{}),
    ...(kind==='image'?{image_model_id:config.image_model_id,image_quality:config.image_quality,image_size:'1536x1024',image_input_tokens_cap:1024,image_output_tokens_reservation:1400}:{}),
    input_tokens_cap_including_overhead:kind==='comparison'?18000:12000,cycle_budget_micro_usd_cap:config.cycle_budget_micro_usd_cap,
    daily_budget_micro_usd_cap:config.daily_budget_micro_usd_cap,
    article_budget_micro_usd_cap_including_all_attempts:config.article_budget_micro_usd_cap});
}
export const apiTextPolicy=(editorial,config)=>apiOperationPolicy(editorial,config,'text');

export const API_FALLBACK_REASONS=new Set(['openai_disabled','openai_operation_disabled','openai_circuit_open','credentials_missing','benefit_unverified',
  'free_credit_isolation_required','credit_envelope_unverified','free_credit_exhausted','free_credit_reservation_required',
  'price_missing','price_unapproved_or_expired','cycle_budget','daily_budget','article_budget','input_limit',
  'attempt_limit','openai_credit_limit','reservation_expired','image_price_missing','image_price_unapproved_or_expired']);
export const GOOGLE_FALLBACK_REASONS=new Set(['google_token_limit','google_call_limit','google_quota_exhausted','google_quota_low',
  'google_quota_unavailable','google_auth_required','google_access_unverified','google_access_unavailable','google_subscription_unverified',
  'google_client_unavailable','credentials_missing']);
