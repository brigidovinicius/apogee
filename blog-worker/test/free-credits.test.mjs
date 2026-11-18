import test from 'node:test';
import assert from 'node:assert/strict';
import {freeCreditStatus,validateGrant} from '../src/policy.mjs';
import {openAIProvider} from '../src/provider.mjs';
import {openAIImageProvider,coverBrief,imageRequest} from '../src/images.mjs';
import {identity,grant,reservation,imagePolicy,article} from './fixtures.mjs';

test('only an isolated free-credit grant with current evidence opens authorization',()=>{
  const at=new Date(),g=grant(at);
  assert.deepEqual(freeCreditStatus([g],identity,at),{eligible:true,reason:null,expires_at:g.expires_at});
  for(const grants of [[],[g,g]])assert.equal(freeCreditStatus(grants,identity,at).eligible,false);
  for(const change of [{billing_scope:undefined},{billing_scope:'authorized_shared_organization'},
    {no_paid_balance:false},{no_paid_billing:false},{dedicated_project:false}])
    assert.deepEqual(freeCreditStatus([{...g,...change}],identity,at),{eligible:false,reason:'free_credit_isolation_required'});
  assert.equal(freeCreditStatus([g],{},at).eligible,false);
  assert.deepEqual(freeCreditStatus([{...g,remaining_micro_usd:0}],identity,at),{eligible:false,reason:'free_credit_exhausted'});
});

test('offers, expiry, revocation, stale evidence and recharge block free-credit authorization',()=>{
  const at=new Date(),g=grant(at);
  for(const change of [{state:'offered'},{balance_type:'purchased'},{no_auto_recharge:false},
    {expires_at:new Date(+at+300000).toISOString()},{revoked_at:at.toISOString()},
    {verified_at:new Date(+at-900001).toISOString()},{verified_at:new Date(+at+1).toISOString()},
    {organization_id:'another-org'},{project_id:'another-project'}])
    assert.throws(()=>validateGrant({...g,...change},at,identity),/benefit_unverified/);
});

test('text, token counting and images send zero requests without isolated free-credit authorization',async()=>{
  const fetcher=()=>assert.fail('No provider request is permitted');
  const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher});
  const imageProvider=openAIImageProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher});
  for(const change of [{credit_grant:undefined},{credit_grant:{...grant(),no_paid_balance:false}},
    {credit_grant:{...grant(),no_auto_recharge:false}},{reserved_micro_usd:0},
    {reserved_micro_usd:16000001},{reserved_micro_usd:undefined}]){
    const r={...reservation(),...change};
    assert.equal((await provider(r)).outcome,'not_sent');
    const image={...r,kind:'image',policy:imagePolicy,body:imageRequest(coverBrief(article),imagePolicy)};
    assert.equal((await provider(image)).outcome,'not_sent');
    assert.equal((await imageProvider(image)).outcome,'not_sent');
  }
});

test('grant expiring during counting blocks generation without retry or an unknown charge',async()=>{
  const at=new Date(),r=reservation(at);let clock=+at,calls=0;
  r.credit_grant.expires_at=new Date(clock+300001).toISOString();
  const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,now:()=>clock,fetcher:async url=>{
    calls++;assert.ok(url.endsWith('/input_tokens'));clock+=2;
    return new Response(JSON.stringify({input_tokens:100}));
  }});
  assert.deepEqual(await provider(r),{outcome:'not_sent',reason:'benefit_unverified'});
  assert.equal(calls,1);
});
