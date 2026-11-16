import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGrant,creditEnvelopeMonths,validateCreditEnvelope} from '../src/policy.mjs';
import {apiTextPolicy,DEFAULT_OPENAI_CONFIG} from '../src/openai-routing.mjs';
import {openAIProvider} from '../src/provider.mjs';
import {tick} from '../src/worker.mjs';
import {defaultPolicy,cappedGrant,identity,reservation} from './fixtures.mjs';

const config={...DEFAULT_OPENAI_CONFIG,enabled:true};
const editorial={...defaultPolicy,generation_enabled:true,google_account_email:'blog-owner@example.test',operator_commands_only:false};

test('hard organization caps cover every UTC billing month before credit expiration with an independent reserve',()=>{
  const at=new Date('2026-11-16T18:00:00.123Z'),g=cappedGrant(at);
  g.expires_at='2026-12-11T13:00:06.000Z';g.hard_limit_valid_until=g.expires_at;
  assert.equal(creditEnvelopeMonths(g.starts_at,g.expires_at),2);
  assert.deepEqual(validateCreditEnvelope(g,at),{months:2,maximum_organization_spend_micro_usd:20000000,margin_micro_usd:20000000});
  validateGrant(g,at,identity);
  validateGrant({...g,starts_at:new Date(g.starts_at),expires_at:new Date(g.expires_at),verified_at:new Date(g.verified_at)},at,identity);
  assert.equal(creditEnvelopeMonths('2026-11-01T00:00:00Z','2026-12-01T00:00:00Z'),1);
  assert.equal(creditEnvelopeMonths('2026-11-01T00:00:00Z','2026-12-01T00:00:00.001Z'),2);
  for(const change of [{organization_hard_limit_enforced:false},{hard_limit_scope:'project'},
    {organization_monthly_limit_micro_usd:10000001},{credit_safety_buffer_micro_usd:19999999},
    {remaining_micro_usd:39999999},{no_auto_recharge:false},{dedicated_blog_key:false},
    {hard_limit_verified_at:'2026-11-01T00:00:00Z'},{hard_limit_valid_until:'2026-12-12T00:00:00Z'},
    {limit_change_invalidates_authorization:false}])assert.throws(()=>validateGrant({...g,...change},at,identity));
});

test('API writing keeps the reviewed editorial policy and cannot enable API images, a model upgrade or a bigger budget',()=>{
  const p=apiTextPolicy(editorial,config);
  assert.equal(p.provider,'openai_api');assert.equal(p.model_id,'gpt-6-luna');
  assert.deepEqual(p.editorial_policy,editorial);assert.equal(p.automatic_image_generation_enabled,false);
  assert.equal(p.codex_subscription_execution_enabled,false);assert.equal(p.auto_recharge_enabled,false);
  for(const change of [{model_id:'gpt-6-astra'},{cycle_budget_micro_usd_cap:5000001},{daily_budget_micro_usd_cap:250001},
    {article_budget_micro_usd_cap:50001},{auto_recharge_enabled:true},{paid_balance_fallback_enabled:true}])assert.throws(()=>apiTextPolicy(editorial,{...config,...change}));
});

test('only explicit billing rejection codes release a zero-generation receipt; other errors remain uncertain',async()=>{
  for(const code of ['organization_spend_limit_exceeded','project_spend_limit_exceeded','credit_balance_exhausted','insufficient_quota','rate_limit_exceeded']){
    const p=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async()=>new Response(JSON.stringify({error:{code}}),{status:429})});
    const r={...reservation(),policy:{...reservation().policy,input_counting_mode:'local_byte_bound'}};
    assert.equal((await p(r)).outcome,code==='rate_limit_exceeded'?'unknown':'not_generated');
  }
});

test('a local API cap returns the same eligible text operation to Google before any API request',async()=>{
  let google=0,api=0,reserves=0;
  const store={recover:async()=>{},maintenance:async()=>({capture_allowed:false}),apiCircuit:async()=>({blocked:false}),
    nextAutomaticWork:async()=>({method:'reserve',candidateId:'synthetic-candidate'}),
    reserve:async({policy})=>{reserves++;if(policy.provider==='openai_api'){const {fail}=await import('../src/policy.mjs');fail('cycle_budget');}return {status:'reserved'};},
    finish:async()=>({status:'draft'})};
  const result=await tick({store,config:{policy:editorial,sources:[],catalog:[],openai:config},identity,
    provider:async()=>{google++;return {outcome:'completed'};},apiProvider:async()=>{api++;return {outcome:'completed'};}});
  assert.equal(result.generation.status,'draft');assert.equal(result.generation.fallback_reason,'cycle_budget');
  assert.equal(reserves,2);assert.equal(google,1);assert.equal(api,0);
});
