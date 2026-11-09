import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePolicy,validateGrant} from '../src/policy.mjs';
import {coverBrief,imageRequest,imageCost,imageUsageCost,selectImagePrice,validateWebp} from '../src/images.mjs';
import {openAIProvider} from '../src/provider.mjs';
import {policy,price,grant,article,reservation,identity} from './fixtures.mjs';

import {imagePolicy,imagePrice,imageUsage,webpFixture} from './fixtures.mjs';
test('image policy and conservative reservation fit the shared article cap',()=>{
  validatePolicy(imagePolicy);const p=selectImagePrice([imagePrice()],imagePolicy,new Date());
  assert.equal(imageCost(p,1024,1400),47120);assert.equal(imageUsageCost(p,imageUsage),41910);
  assert.throws(()=>validatePolicy({...imagePolicy,image_quality:'high'}),/image_policy/);
  assert.throws(()=>imageUsageCost(p,{...imageUsage,input_tokens_details:{text_tokens:100,image_tokens:50}}),/invalid_usage/);
  assert.throws(()=>selectImagePrice([{...p,billing_mode:'batch'}],imagePolicy,new Date()),/image_price_unapproved/);
  assert.throws(()=>selectImagePrice([{...p,approved:false}],imagePolicy,new Date()),/image_price_unapproved/);
});
test('cover prompt is bounded and output must be a non-animated WebP of the required dimensions',()=>{
  const body=imageRequest(coverBrief(article),imagePolicy);assert.equal(body.n,1);
  assert.throws(()=>imageRequest({prompt:'é'.repeat(800)},imagePolicy),/image_prompt_limit/);
  assert.equal(validateWebp(webpFixture()).width,1536);
  const wrong=webpFixture();wrong.writeUInt16LE(1024,26);assert.throws(()=>validateWebp(wrong),/image_dimensions/);
  assert.throws(()=>validateWebp(Buffer.from('<svg>')),/invalid_image/);
});
test('local byte mode makes one Responses call and oversized dossiers make zero requests',async()=>{
  let calls=0;
  const p=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async url=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');return new Response(JSON.stringify({model:policy.model_id,service_tier:'default',status:'completed',usage:{},output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}));
  }});
  const r={...reservation(),policy:{...policy,input_counting_mode:'local_byte_bound'}};
  assert.equal((await p(r)).outcome,'completed');assert.equal(calls,1);
  r.body.input='x'.repeat(9000);assert.equal((await p(r)).reason,'input_limit');assert.equal(calls,1);
});
test('image adapter pins org/project, generates once, validates binary and never retries uncertainty',async()=>{
  let calls=0;
  const r={...reservation(),kind:'image',policy:imagePolicy,body:imageRequest(coverBrief(article),imagePolicy)};
  const p=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(options.headers['OpenAI-Organization'],identity.organization_id);
    assert.equal(options.headers['OpenAI-Project'],identity.project_id);
    return new Response(JSON.stringify({data:[{b64_json:webpFixture().toString('base64')}],usage:imageUsage}));
  }});
  assert.equal((await p(r)).outcome,'completed');assert.equal(calls,1);
  const broken=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async()=>{calls++;throw Error('timeout');}});
  assert.equal((await broken(r)).outcome,'unknown');assert.equal(calls,2);
});
test('shared Vinicius organization requires explicit authorization, recent credit observation and buffer',()=>{
  const identity={organization_id:'org-approved-shared',project_id:'proj-approved-shared'};
  const at=new Date(),g={...grant(at),...identity,billing_scope:'authorized_shared_organization',no_paid_balance:false,no_paid_billing:false,dedicated_project:false,
    authorization_reference:'User explicitly authorized Vinicius organization credits for this blog',credit_safety_buffer_micro_usd:1000000};
  validateGrant(g,at,identity);
  for(const change of [{authorization_reference:''},{verified_at:new Date(+at-900001).toISOString()},{remaining_micro_usd:1000000},{no_auto_recharge:false},{project_id:'other'}])assert.throws(()=>validateGrant({...g,...change},at,identity));
});
