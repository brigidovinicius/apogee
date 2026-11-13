import {createHash} from 'node:crypto';

export class Blocked extends Error { constructor(code) { super(code); this.code=code; } }
export const fail=code=>{throw new Blocked(code);};
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(stable(value))).digest('hex');
export const CATEGORIES=Object.freeze({ia:'tecnologia',startups:'empreendedorismo','ciencia-espaco':'ciencias',tecnologia:'tecnologia',oportunidades:'estudos'});
const ceilings={cycle_budget_micro_usd_cap:5000000,cycle_grant_fraction_cap_basis_points:1000,
  daily_budget_micro_usd_cap:250000,article_budget_micro_usd_cap_including_all_attempts:50000,
  new_drafts_per_day_cap:1,new_drafts_per_week_cap:5,concurrency:1,input_tokens_cap_including_overhead:8000,
  billed_output_tokens_cap_including_reasoning:2000,max_primary_evidence_documents:2,max_provider_attempts_per_article_including_repairs:2};
const disabled=['paid_web_search_enabled','paid_storage_tools_enabled',
  'automatic_video_generation_enabled','codex_subscription_execution_enabled','gemini_api_enabled','google_consumer_auth_worker_enabled',
  'paid_balance_fallback_enabled','auto_recharge_enabled','automatic_model_upgrade_enabled','retry_after_unknown_charge'];
const required=['verified_grant_required','blog_scope_only','unknown_charge_holds_reservation','block_without_approved_price_catalog',
  'block_without_valid_benefit','block_on_insufficient_reserved_budget','reuse_unchanged_dossier_result','human_review_required_in_pilot'];
export function validatePolicy(p) {
  if(p?.provider==='google_subscription')return validateGooglePolicy(p);
  if(p?.schema_version!==1 || p.provider!=='openai_api' || p.allowed_balance_type!=='included_subscription_benefit_only'
    || p.timezone!=='America/Sao_Paulo' || p.budget_currency!=='USD' || typeof p.generation_enabled!=='boolean'
    || typeof p.policy_id!=='string' || !p.policy_id || disabled.some(k=>p[k]!==false) || required.some(k=>p[k]!==true))fail('invalid_policy');
  for(const [k,max] of Object.entries(ceilings))if(!Number.isSafeInteger(p[k])||p[k]<1||p[k]>max)fail('policy_limit');
  // Newer canonical model IDs are versioned names rather than date-suffixed snapshots.
  // Only the explicitly reviewed canonical ID is admitted; no family aliases or automatic resolver.
  if(p.model_id!==null && (typeof p.model_id!=='string' || (p.model_id!=='gpt-6-luna'&&!/^gpt-[a-z0-9.-]+-\d{4}-\d{2}-\d{2}$/.test(p.model_id)) || /codex/i.test(p.model_id)))fail('model_not_pinned');
  if(!['none','low'].includes(p.reasoning_effort))fail('reasoning_limit');
  if(p.input_counting_mode!==undefined&&!['local_byte_bound','provider'].includes(p.input_counting_mode))fail('counting_mode');
  if(p.operator_commands_only!==undefined&&typeof p.operator_commands_only!=='boolean')fail('invalid_policy');
  if(typeof p.automatic_image_generation_enabled!=='boolean')fail('invalid_policy');
  if(p.automatic_image_generation_enabled && (p.image_model_id!=='gpt-image-2' || p.image_quality!=='medium'
    || p.image_size!=='1536x1024' || p.image_input_tokens_cap!==1024 || p.image_output_tokens_reservation!==1400))fail('image_policy');
  return Object.freeze(structuredClone(p));
}
export function periodKeys(at) {
  const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
  const monday=new Date(day+'T12:00:00Z');monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
  return {day,week:monday.toISOString().slice(0,10)};
}
const integer=x=>Number.isSafeInteger(x)&&x>=0;
export function selectPrice(catalog,policy,at) {
  if(!policy.generation_enabled)fail('generation_disabled');
  const entries=catalog.filter(p=>p.model===policy.model_id);
  if(entries.length!==1)fail('price_missing');
  const p=entries[0],now=+at;
  if(p.approved!==true || p.provider!=='openai_api' || p.currency!=='USD' || (policy.input_counting_mode!=='local_byte_bound' && p.input_counting_free_verified!==true)
    || p.service_tier!=='default' || p.prompt_cache_ttl!=='30m'
    || !integer(p.input_micro_usd_per_million) || !integer(p.output_micro_usd_per_million)
    || !integer(p.cached_input_micro_usd_per_million) || !integer(p.cache_write_micro_usd_per_million)
    || p.input_micro_usd_per_million===0 || p.output_micro_usd_per_million===0 || p.fixed_micro_usd!==0
    || !Number.isFinite(Date.parse(p.verified_at)) || Date.parse(p.verified_at)>now || now-Date.parse(p.verified_at)>7*86400000
    || !(Date.parse(p.valid_until)>now+300000) || !/^https:\/\/(developers|platform)\.openai\.com\//.test(p.evidence_url??''))fail('price_unapproved_or_expired');
  return p;
}
export function usageCost(price,input,output) {
  if(!integer(input)||!integer(output))fail('invalid_usage');
  // Reserve every input token at the most expensive applicable input class, including cache writes.
  const worst=Math.max(price.input_micro_usd_per_million,price.cached_input_micro_usd_per_million,price.cache_write_micro_usd_per_million);
  if(!integer(worst))fail('invalid_price');
  const cost=(BigInt(input)*BigInt(worst)+999999n)/1000000n
    +(BigInt(output)*BigInt(price.output_micro_usd_per_million)+999999n)/1000000n;
  if(cost>BigInt(Number.MAX_SAFE_INTEGER))fail('invalid_cost');
  return Number(cost);
}
export function actualUsageCost(price,usage) {
  const input=usage?.input_tokens,output=usage?.output_tokens;
  const cached=usage?.input_tokens_details?.cached_tokens,written=usage?.input_tokens_details?.cache_write_tokens;
  if(![input,output,cached,written,usage?.total_tokens].every(integer) || cached+written>input || usage.total_tokens!==input+output)fail('invalid_usage');
  const weighted=BigInt(input-cached-written)*BigInt(price.input_micro_usd_per_million)
    +BigInt(cached)*BigInt(price.cached_input_micro_usd_per_million)+BigInt(written)*BigInt(price.cache_write_micro_usd_per_million);
  const cost=(weighted+999999n)/1000000n+(BigInt(output)*BigInt(price.output_micro_usd_per_million)+999999n)/1000000n;
  if(cost>BigInt(Number.MAX_SAFE_INTEGER))fail('invalid_cost');return Number(cost);
}
export function validateGrant(g,at,identity) {
  const now=+at;
  const shared=g?.billing_scope==='authorized_shared_organization';
  const scope=shared
    ? g.organization_id==='org-approved-shared' && g.project_id==='proj-approved-shared'
      && g.no_paid_balance===false && g.no_paid_billing===false && g.dedicated_project===false
      && typeof g.authorization_reference==='string' && g.authorization_reference.length>=20
      && g.credit_safety_buffer_micro_usd===1000000 && Number(g.remaining_micro_usd)>1000000
    : g?.no_paid_balance===true && g?.no_paid_billing===true && g?.dedicated_project===true;
  if(!g || g.state!=='granted' || g.balance_type!=='included_subscription_benefit_only'
    || g.organization_id!==identity.organization_id || g.project_id!==identity.project_id
    || !g.provider_grant_id || !g.verification_reference || !scope || g.no_auto_recharge!==true || g.revoked_at
    || !integer(Number(g.amount_micro_usd)) || Number(g.amount_micro_usd)<1
    || !integer(Number(g.remaining_micro_usd)) || Number(g.remaining_micro_usd)>Number(g.amount_micro_usd)
    || !(Date.parse(g.starts_at)<=now) || !(Date.parse(g.expires_at)>now+300000)
    || !Number.isFinite(Date.parse(g.verified_at)) || Date.parse(g.verified_at)>now || now-Date.parse(g.verified_at)>(shared?900000:86400000))fail('benefit_unverified');
  return g;
}
export function cycleCap(policy,grant) {
  return Math.min(policy.cycle_budget_micro_usd_cap,Number(BigInt(grant.amount_micro_usd)*BigInt(policy.cycle_grant_fraction_cap_basis_points)/10000n));
}
export function assertWindow(at) {
  const day=periodKeys(at).day;
  if(periodKeys(new Date(+at+300000)).day!==day)fail('day_boundary');
}

export function validateGooglePolicy(p) {
  const forcedFalse=['paid_web_search_enabled','paid_storage_tools_enabled','automatic_video_generation_enabled','codex_subscription_execution_enabled','gemini_api_enabled','paid_balance_fallback_enabled','auto_recharge_enabled','automatic_model_upgrade_enabled','retry_after_unknown_charge','google_use_g1_credits'];
  if(![2,3].includes(p.schema_version) || p.allowed_balance_type!=='google_ai_pro_baseline_only' || !(p.google_account_email===null&&!p.generation_enabled || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.google_account_email??''))
    || p.google_subscription_required!==true || p.google_consumer_auth_worker_enabled!==true || p.human_review_required_in_pilot!==true
    || p.timezone!=='America/Sao_Paulo' || p.budget_currency!=='USD' || typeof p.generation_enabled!=='boolean'
    || typeof p.automatic_image_generation_enabled!=='boolean' || typeof p.operator_commands_only!=='boolean'
    || p.model_id!=='gemini-3.8-flash-low' || p.image_model_id!=='antigravity_generate_image' || p.reasoning_effort!=='low'
    || forcedFalse.some(k=>p[k]!==false) || ['cycle_budget_micro_usd_cap','daily_budget_micro_usd_cap','article_budget_micro_usd_cap_including_all_attempts'].some(k=>p[k]!==0))fail('google_policy');
  if(p.google_automatic_access_validation_enabled!==undefined&&typeof p.google_automatic_access_validation_enabled!=='boolean')fail('google_policy');
  if(p.automatic_explainers_enabled!==undefined&&typeof p.automatic_explainers_enabled!=='boolean')fail('google_policy');
  if(p.automatic_explainers_enabled===true&&(!Number.isInteger(p.explainer_after_local_hour)||p.explainer_after_local_hour<6||p.explainer_after_local_hour>20||p.schema_version!==3))fail('google_policy');
  const caps={new_drafts_per_day_cap:p.schema_version===3?10:1,new_drafts_per_week_cap:p.schema_version===3?70:5,concurrency:1,input_tokens_cap_including_overhead:p.schema_version===3?12000:8000,billed_output_tokens_cap_including_reasoning:2000,max_primary_evidence_documents:p.schema_version===3?10:2,max_provider_attempts_per_article_including_repairs:p.schema_version===3?3:2,google_daily_calls_cap:p.schema_version===3?40:3,google_weekly_calls_cap:p.schema_version===3?280:15,google_daily_tokens_cap:180000,google_weekly_tokens_cap:900000,google_tokens_reserved_per_call:60000,google_max_invocations_per_call:1,google_timeout_seconds:150};
  for(const [k,max] of Object.entries(caps))if(!Number.isSafeInteger(p[k])||p[k]<1||p[k]>max)fail('google_policy_limit');
  const completion=p.google_daily_completion;
  if(completion!==undefined&&(p.schema_version!==3||!completion||typeof completion!=='object'
    ||!/^\d{4}-\d{2}-\d{2}$/.test(completion.day??'')||!Number.isFinite(Date.parse(completion.day+'T12:00:00Z'))
    ||new Date(completion.day+'T12:00:00Z').toISOString().slice(0,10)!==completion.day
    ||!Number.isSafeInteger(completion.calls_cap)||completion.calls_cap<p.google_daily_calls_cap||completion.calls_cap>80
    ||!Number.isSafeInteger(completion.tokens_reserved_per_call)||completion.tokens_reserved_per_call<15000||completion.tokens_reserved_per_call>30000
    ||typeof completion.authorization_reference!=='string'||completion.authorization_reference.length<20))fail('google_completion_policy');
  if(p.schema_version===3 && (p.multisource_required!==true || p.minimum_compatibility_basis_points!==9000 || p.critical_fact_confirmation_required!==true || p.per_topic_daily_cap!==1 || p.per_topic_weekly_cap!==7))fail('google_policy');
  if(p.input_counting_mode!=='local_byte_bound' || p.image_size!=='1536x1024')fail('google_policy');
  return Object.freeze(structuredClone(p));
}
// A dated completion allowance never changes the weekly/token limits, provider
// quota checks, or the normal day after midnight in Brasilia.
export function googleUsageLimits(policy,at=new Date()){
  const completion=policy.google_daily_completion;
  return completion?.day===periodKeys(at).day
    ?{dailyCalls:completion.calls_cap,reservedTokens:completion.tokens_reserved_per_call}
    :{dailyCalls:policy.google_daily_calls_cap,reservedTokens:policy.google_tokens_reserved_per_call};
}
export function validateSubscriptionBinding(a,at=new Date(),expectedEmail=null) {
  if(!a || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.account_email??'')) || (expectedEmail!==null&&a.account_email!==expectedEmail) || a.plan!=='google_ai_pro' || a.auth_method!=='official_google_oauth' || a.use_g1_credits!==false
    || typeof a.verification_reference!=='string' || a.verification_reference.length<20
    || !(Date.parse(a.verified_at)<=+at) || !(Date.parse(a.valid_until)>Date.parse(a.verified_at))
    || Date.parse(a.valid_until)-Date.parse(a.verified_at)>86400000)fail('google_subscription_unverified');
  return a;
}
export function validateSubscription(a,at=new Date(),expectedEmail=null) {
  validateSubscriptionBinding(a,at,expectedEmail);
  if(!(Date.parse(a.valid_until)>+at+180000))fail('google_subscription_unverified');
  return a;
}
export function subscriptionUsage(usage) {
  const fields=['input_tokens','output_tokens','thinking_tokens','cache_read_tokens','total_tokens'];
  if(!usage || fields.some(k=>!Number.isSafeInteger(usage[k])||usage[k]<0))fail('google_usage_missing');
  // Conservative local workload counter. This is not a percentage of Google's plan quota.
  const tokens=Math.max(usage.total_tokens,usage.input_tokens+usage.output_tokens+usage.thinking_tokens+usage.cache_read_tokens);
  if(!Number.isSafeInteger(tokens))fail('google_usage_missing');return tokens;
}
