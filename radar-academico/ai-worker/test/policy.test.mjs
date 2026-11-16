import test from 'node:test';
import assert from 'node:assert/strict';
import { base, decideMode, prepareRequest, failureKind, LIMITS } from '../policy.mjs';
import { runtimeStatus } from '../cli.mjs';
import { dispatch } from '../dispatch.mjs';
const now = Date.parse('2026-11-18T14:00:00Z');
const receipt = () => ({ enabled:true,manual_paused:false,cycle_id:'november-18',product:'radar',project_matches:true,
  starts_at:'2026-11-18T13:00:00Z',ends_at:'2026-12-18T13:00:00Z',verified_at:'2026-11-18T13:30:00Z',proof_until:'2026-11-18T15:00:00Z',free_only_verified:true,free_micro:50_000_000 });

test('monthly budgets are isolated and sum to the absolute cap', () => {
  assert.equal(Object.values(LIMITS.streams).reduce((a,b)=>a+b,0),LIMITS.operational);
  assert.equal(LIMITS.cycle,50_000_000);
});
for (const [label,patch,mode,reason] of [
  ['disabled',{enabled:false},'BASE','disabled'],['manual pause',{manual_paused:true},'BASE','operator_pause'],
  ['foreign product',{product:'blog'},'BASE_CONTROLE','allocation_unverified'],
  ['foreign project',{project_matches:false},'BASE_CONTROLE','allocation_unverified'],
  ['expired',{ends_at:'2026-11-18T13:59:00Z'},'BASE_CREDITO','credit_expired'],
  ['future',{starts_at:'2026-11-19T13:00:00Z'},'BASE_CONTROLE','allocation_unverified'],
  ['stale proof',{proof_until:'2026-11-18T13:59:00Z'},'BASE_CONTROLE','billing_unverified'],
  ['paid balance only',{free_micro:0},'BASE_CREDITO','credit_exhausted'],
  ['no billing barrier',{free_only_verified:false},'BASE_CONTROLE','billing_unverified'],
  ['overlong proof',{proof_until:'2026-11-19T15:00:00Z'},'BASE_CONTROLE','allocation_unverified'],
  ['API circuit',{circuit_until:'2026-11-18T15:00:00Z'},'BASE_API','api_unavailable'],
  ['credit circuit',{circuit_until:'2026-11-18T15:00:00Z',circuit_reason:'credit_balance_exhausted'},'BASE_CREDITO','credit_balance_exhausted'],
]) test(`mode: ${label}`,()=>assert.deepEqual(decideMode({...receipt(),...patch},now),{mode,reason}));

test('calendar month boundaries cannot renew the November 18 allocation',()=>{
  assert.equal(decideMode(receipt(),Date.parse('2026-12-01')).mode,'BASE_CONTROLE'); // stale proof, not new credit
  assert.equal(decideMode(receipt(),Date.parse('2026-12-19')).mode,'BASE_CREDITO');
  assert.equal(decideMode(receipt(),now).mode,'AMPLIADO');
});
test('runtime is inert even if enabled accidentally; no secrets enter its status',()=>{
  assert.deepEqual(runtimeStatus({}),{mode:'BASE',reason:'disabled'});
  assert.deepEqual(runtimeStatus({RADAR_AI_ENABLED:'true',OPENAI_API_KEY:'do-not-print'}),{mode:'BASE_CONTROLE',reason:'transport_disabled'});
});
test('requests bind complete text bytes, output and identity; tools cannot bypass cost bounds',()=>{
  const body={model:'test-model',max_output_tokens:120,input:'Ação',tools:[]};
  const request=prepareRequest('radar:test:0001','evaluation',body);
  assert.equal(request.inputBound,Buffer.byteLength(JSON.stringify(body))+4096);
  assert.equal(request.requestHash.length,64);
  body.input='mutated'; assert.equal(request.body.input,'Ação');
  assert.throws(()=>{request.body.input='mutated again';});
  for(const patch of [{tools:[{type:'web_search'}]},{max_output_tokens:0},{background:true},{input:'x'.repeat(65000)},
    {input:[{type:'input_image',image_url:'external'}]},{unexpected:'unbounded'}])
    assert.throws(()=>prepareRequest('radar:test:0001','evaluation',{...body,...patch}));
  assert.throws(()=>prepareRequest('radar:test:0001','blog',body));
});
test('429 rate limiting is not credit exhaustion',()=>{
  assert.equal(failureKind({status:429}),'rate_limited');
  assert.equal(failureKind({status:429,code:'credit_balance_exhausted'}),'credit_balance_exhausted');
});
test('a credit or pause change between status and send keeps its explicit fallback mode',()=>{
  assert.equal(base('credit_expired').mode,'BASE_CREDITO');
  assert.equal(base('cycle_limit').mode,'BASE_CREDITO');
  assert.equal(base('operator_pause').mode,'BASE');
  assert.equal(base('rate_limited').mode,'BASE_API');
});
test('missing transport or failed ledger serves base without any provider call',async()=>{
  let called=0,baseCalls=0;
  const onBase=()=>{baseCalls++;return ['existing-catalogue'];};
  const a=await dispatch({store:{status(){throw Error();}},onBase});
  assert.deepEqual(a.result,['existing-catalogue']);
  const b=await dispatch({store:{status(){throw Error();}},provider:()=>called++,onBase});
  assert.equal(b.reason,'control_unavailable');assert.equal(called,0);assert.equal(baseCalls,2);
});
test('uncertain work is held without preventing other base queries',async()=>{
  const finishes=[];
  const store={status:async()=>receipt(),reserve:async()=>({status:'reserved',id:'id'}),markSent:async()=>({sent:true}),finish:async(...args)=>finishes.push(args)};
  const request=prepareRequest('radar:test:0001','evaluation',{model:'test-model',input:'fixture',max_output_tokens:10});
  const r=await dispatch({store,request,now:()=>now,provider:async()=>{throw Object.assign(Error('timeout'),{notSent:true});},onBase:()=>['base']});
  assert.equal(r.mode,'BASE_API');assert.equal(finishes[0][1],'unknown');assert.deepEqual(r.result,['base']);
});
