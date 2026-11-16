import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAIProvider, responseCost } from '../openai.mjs';
import { dispatch } from '../dispatch.mjs';
import { prepareRequest } from '../policy.mjs';

const tariff = { model:'gpt-6-luna',approved:true,price_version:'synthetic-20261116',valid_until:'2099-01-01',
  input_micro_per_million:100000,cached_input_micro_per_million:10000,cache_write_micro_per_million:125000,output_micro_per_million:500000 };
const body={model:'gpt-6-luna',input:'Public source text',max_output_tokens:256,store:false,service_tier:'default'};
const context={operationId:'1159fa5a-1647-4f1d-a344-c12579eb21a1',maximumMicro:10000,responseTariff:tariff,organizationId:'org-synthetic123',projectId:'proj_synthetic123'};
const config={apiKey:'sk-synthetic_not_a_real_key_12345',organizationId:'org-synthetic123',projectId:'proj_synthetic123'};
const usage={input_tokens:1000,output_tokens:100,total_tokens:1100,input_tokens_details:{cached_tokens:200,cache_write_tokens:300}};
const result=(patch={})=>({id:'resp_synthetic1234',status:'completed',model:body.model,service_tier:'default',usage,
  output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'{"quotes":["Public source text"]}'}]}],...patch});
const response=(value,init={})=>new Response(JSON.stringify(value),{headers:{'content-type':'application/json','x-request-id':'req_synthetic'},...init});
test('actual cost includes cache writes, cached input and all reasoning/output tokens with upward integer rounding',()=>{
  assert.equal(responseCost(usage,tariff),140);
  assert.equal(responseCost({input_tokens:1,output_tokens:1,total_tokens:2,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}},tariff),1);
  for(const invalid of [{...usage,total_tokens:1},{...usage,input_tokens:499},{...usage,input_tokens_details:{cached_tokens:200}},null])
    assert.throws(()=>responseCost(invalid,tariff),/usage_unknown/);
});
test('only the fixed official endpoint, selected org/project and reserved request are sent; storage is off and redirects refused',async()=>{
  const calls=[];const provider=createOpenAIProvider({...config,fetchImpl:async(...args)=>{calls.push(args);return response(result());}});
  const r=await provider(body,context);assert.equal(r.costMicro,140);assert.equal(r.value.responseId,'resp_synthetic1234');
  assert.equal(calls.length,1);const [url,init]=calls[0];assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(init.redirect,'error');assert.equal(init.headers['OpenAI-Organization'],config.organizationId);
  assert.equal(init.headers['OpenAI-Project'],config.projectId);assert.equal(init.headers['X-Client-Request-Id'],context.operationId);
  assert.equal(JSON.parse(init.body).store,false);assert.equal(JSON.parse(init.body).service_tier,'default');
});
test('credential, tariff, storage and service tier failures cannot reach HTTP',async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return response(result());};
  assert.throws(()=>createOpenAIProvider({...config,apiKey:'not-a-key',fetchImpl}),/credentials_unavailable/);
  const provider=createOpenAIProvider({...config,fetchImpl});
  for(const [b,c] of [[body,{}],[body,{...context,maximumMicro:1}],[body,{...context,responseTariff:{...tariff,approved:false}}],
    [body,{...context,responseTariff:{...tariff,valid_until:'2000-01-01'}}],[body,{...context,projectId:'proj_other123'}],[{...body,store:true},context],
    [{...body,service_tier:'priority'},context],[{...body,tools:[{type:'web_search'}]},context]]) await assert.rejects(provider(b,c));
  assert.equal(calls,0);
});
test('authentication, rate and credit failures are sanitized and never automatically retried',async()=>{
  for(const [status,code,expected] of [[401,'invalid_api_key','api_unavailable'],[429,'rate_limit_exceeded','rate_limited'],[429,'insufficient_quota','credit_balance_exhausted']]){
    let calls=0;const provider=createOpenAIProvider({...config,fetchImpl:async()=>{calls++;return response({error:{code,message:config.apiKey}},{status});}});
    await assert.rejects(provider(body,context),error=>error.code===expected&&!String(error).includes(config.apiKey));assert.equal(calls,1);
  }
});
test('unexpected model, tier, usage or overlarge reply keeps the cost unknown',async()=>{
  for(const value of [result({model:'another-model'}),result({service_tier:'priority'}),result({usage:null}),result({id:'invalid'})]){
    await assert.rejects(createOpenAIProvider({...config,fetchImpl:async()=>response(value)})(body,context),/usage_unknown/);
  }
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(262145));c.close();}});
  await assert.rejects(createOpenAIProvider({...config,fetchImpl:async()=>new Response(stream,{headers:{'content-type':'application/json'}})})(body,context),/usage_unknown/);
  let cancelled=false;
  const rejected=new ReadableStream({cancel(){cancelled=true;}});
  await assert.rejects(createOpenAIProvider({...config,fetchImpl:async()=>new Response(rejected,{headers:{'content-type':'application/json','content-length':'262145'}})})(body,context),/usage_unknown/);
  assert.equal(cancelled,true);
});
function fakeStore(snapshot,patch={}){
  const events=[];return {events,status:async()=>snapshot,reserve:async()=>({status:'reserved',id:context.operationId,maximum_micro:10000,response_tariff:tariff,organization_id:config.organizationId,project_id:config.projectId}),
    markSent:async()=>{events.push('sent');return {sent:true};},finish:async(...args)=>{events.push(args);return {accepted:true};},...patch};
}
const snapshot={enabled:true,manual_paused:false,cycle_id:'test',product:'radar',project_matches:true,
  starts_at:'2026-11-01T03:00:00Z',ends_at:'2026-12-01T03:00:00Z',verified_at:'2026-11-16T12:00:00Z',proof_until:'2026-11-16T17:00:00Z',free_only_verified:true,free_micro:50000000};
test('preflight failure releases only an unsent reservation; paused or expired billing proof cannot call HTTP',async()=>{
  let calls=0;const provider=createOpenAIProvider({...config,fetchImpl:async()=>{calls++;return response(result());}});
  const run=store=>dispatch({store,provider,request:prepareRequest('tests:real:transport','extraction',body),now:()=>Date.parse('2026-11-16T14:00:00Z'),onBase:()=>null});
  for(const s of [{...snapshot,manual_paused:true},{...snapshot,proof_until:'2026-11-16T13:00:00Z'}]) await run(fakeStore(s));
  const store=fakeStore(snapshot,{reserve:async()=>({status:'reserved',id:context.operationId,maximum_micro:10000})});
  await run(store);assert.equal(calls,0);assert.equal(store.events.length,1);assert.equal(store.events[0][1],'not_sent');
});
test('a completed response is settled after the send gate and incomplete text still accounts for billed usage',async()=>{
  for(const status of ['completed','incomplete']){
    const store=fakeStore(snapshot);const provider=createOpenAIProvider({...config,fetchImpl:async()=>{assert.equal(store.events[0],'sent');return response(result({status}));}});
    const r=await dispatch({store,provider,request:prepareRequest('tests:real:transport','extraction',body),now:()=>Date.parse('2026-11-16T14:00:00Z'),onBase:()=>null});
    assert.equal(r.mode,'AMPLIADO');assert.equal(store.events[1][1],'confirmed');assert.equal(store.events[1][2],140);assert.equal(r.proposal.complete,status==='completed');
  }
});
