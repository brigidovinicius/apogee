import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {apiOperationPolicy,DEFAULT_OPENAI_CONFIG,validateOpenAIConfig} from '../src/openai-routing.mjs';
import {validatePolicy,fail} from '../src/policy.mjs';
import {buildComparisonRequest,dossierHash} from '../src/corroboration.mjs';
import {renewableExplainerPlans,nextReferenceDiscovery} from '../src/replenishment.mjs';
import {ARTICLE_EXTRACTION_VERSION} from '../src/article-research.mjs';
import {tick} from '../src/worker.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';
import {defaultPolicy,identity,grant} from './fixtures.mjs';
import {openAIProvider} from '../src/provider.mjs';

const openai={...DEFAULT_OPENAI_CONFIG,schema_version:2,enabled:true,comparison_enabled:true,image_enabled:true,image_model_id:'gpt-image-2.5-flare-2026-09-08',image_quality:'low'};
const editorial={...defaultPolicy,generation_enabled:true,google_account_email:'blog-owner@example.test',operator_commands_only:false};
const at=new Date('2026-11-19T15:00:00Z');

test('all 18 actual rejected discovery pairs are filtered before another metered comparison',async()=>{
 const pairs=JSON.parse(await readFile(new URL('./fixtures/rejected-discovery-20261119.json',import.meta.url)));
 assert.equal(pairs.length,18);
 for(const pair of pairs){
  const captures=pair.map(d=>({...d,extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,checked_at:at.toISOString()}));
  assert.equal(renewableExplainerPlans(captures,{at}).length,0,pair.map(d=>d.title).join(' + '));
 }
});
test('course suffixes cannot pair an acknowledgments page, exercise or unrelated guide with a research profile',()=>{
 const base={text:'Source documentation and factual context. '.repeat(30),checked_at:at.toISOString(),extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,rights_reference:'public excerpt'};
 const urls=['acknowledgments','citing','faq','test-your-knowledge','advanced-courses'];
 const parent={...base,url:'https://developers.google.com/machine-learning/crash-course',title:'Machine Learning Crash Course',related_urls:urls.map(x=>'https://developers.google.com/machine-learning/crash-course/'+x)};
 assert.equal(nextReferenceDiscovery([parent],{at}),null);
});
test('versioned opt-in capabilities preserve legacy text-only mode and all monetary and credit guards',()=>{
 for(const kind of ['comparison','image'])assert.throws(()=>apiOperationPolicy(editorial,{...DEFAULT_OPENAI_CONFIG,enabled:true},kind),/openai_operation_disabled/);
 for(const kind of ['text','comparison','image']){
  const p=apiOperationPolicy(editorial,openai,kind);assert.equal(p.api_operation,kind);assert.equal(p.paid_balance_fallback_enabled,false);assert.equal(p.auto_recharge_enabled,false);
  assert.equal(p.codex_subscription_execution_enabled,false);assert.equal(p.daily_budget_micro_usd_cap,250000);
  assert.equal(p.editorial_policy.minimum_compatibility_basis_points,9000);
 }
 for(const change of [{image_model_id:'chatgpt-image-latest'},{image_quality:'high'},{daily_budget_micro_usd_cap:500000},{paid_balance_fallback_enabled:true}])assert.throws(()=>validateOpenAIConfig({...openai,...change}));
 assert.throws(()=>validatePolicy({...apiOperationPolicy(editorial,openai,'comparison'),automatic_image_generation_enabled:true}));
});
test('API comparisons retain literal source quotes and protected facts with the official bounded Responses protocol',()=>{
 const d=dossierFixture(2),p=apiOperationPolicy(editorial,openai,'comparison');
 const r=buildComparisonRequest(d,p);
 assert.equal(r.text.format.type,'json_schema');assert.equal(r.text.format.strict,true);assert.equal(r.store,false);assert.deepEqual(r.tools,[]);
 assert.equal(r.background,false);assert.equal(r.service_tier,'default');assert.equal(r.max_output_tokens,2000);
 assert.ok(r.input.includes('quote_units'));assert.ok(Buffer.byteLength(JSON.stringify(r))+1024<=18000);
});
test('API recovery fits a Google-sized dossier by compacting repeated labels and protected facts, without changing source values or the byte cap',()=>{
 const p=apiOperationPolicy(editorial,openai,'comparison');let proved=false;
 for(let length=30;length<=180&&!proved;length++){
  const d=dossierFixture(2);d.claims=[];
  for(const [i,doc] of d.documents.entries()){
   doc.text=('Synthetic source '+i+' preserves "quoted" values and explicit factual limits. ').repeat(length).trim();
   doc.content_hash=dossierHash(doc.text);
  }
  const critical={id:'C1',text:'Fato crítico sintético preservado integralmente, incluindo aspas "originais". '.repeat(3).trim()};
  d.previous_critical_claims=[critical];d.previous_unresolved_claims=[{...critical,critical:true},{id:'C2',text:'Limitação sintética pendente que não pode ser omitida para aumentar a nota.',critical:false}];
  let request;try{request=buildComparisonRequest(d,p);}catch(e){if(e.code==='input_limit')continue;throw e;}
  const sent=JSON.parse(request.input),restored=sent.documents.map(row=>Object.fromEntries(sent.document_columns.map((key,i)=>[key,row[i]])));
  const original=buildComparisonRequest(d,{...editorial,google_comparison_input_bytes_cap:50000}),raw=JSON.parse(original.input);
  assert.deepEqual(restored,raw.documents);assert.deepEqual(sent.protected_claims,[[critical.id,critical.text,true],['C2',d.previous_unresolved_claims[1].text,false]]);
  const expanded={...request,instructions:original.instructions,input:original.input};
  if(Buffer.byteLength(JSON.stringify(expanded))+1024<=p.input_tokens_cap_including_overhead)continue;
  assert.ok(Buffer.byteLength(JSON.stringify(request))+1024<=p.input_tokens_cap_including_overhead);
  assert.equal(p.input_tokens_cap_including_overhead,18000);assert.equal(request.max_output_tokens,2000);assert.match(request.instructions,/90%/);proved=true;
 }
 assert.ok(proved,'a dossier previously rejected only by duplicate serialization fits without dropping evidence');
});
function harness(method,{googleBlock='google_token_limit',apiBlock=null,apiOutcome=null,config=openai}={}){
 const calls=[],reserves=[];
 const store={recover:async()=>{},maintenance:async()=>({capture_allowed:false}),apiCircuit:async()=>({blocked:false}),nextAutomaticWork:async()=>({method,candidateId:'test-candidate'}),
  [method]:async({policy})=>{reserves.push(policy.provider);if(policy.provider==='google_subscription'&&googleBlock)fail(googleBlock);if(policy.provider==='openai_api'&&apiBlock)fail(apiBlock);return {status:'reserved',kind:policy.api_operation};},
  finish:async()=>apiOutcome??{status:method==='reserveComparison'?'comparison_ready':method==='reserveImage'?'cover_ready':'draft'}};
 const run=()=>tick({store,config:{policy:editorial,sources:[],catalog:[],openai:config},identity,
  provider:async()=>{calls.push('google');return {outcome:'completed'};},apiProvider:async()=>{calls.push('api');return {outcome:'completed'};}});
 return {run,calls,reserves};
}
test('local Google token and quota blocks cannot starve comparisons or covers while free-credit API is eligible',async()=>{
 for(const method of ['reserveComparison','reserveImage'])for(const reason of ['google_token_limit','google_call_limit','google_quota_low','google_auth_required']){
  const h=harness(method,{googleBlock:reason}),result=await h.run();assert.equal(result.generation.provider,'openai_api');assert.deepEqual(h.calls,['api']);assert.equal(result.generation.fallback_reason,reason);
 }
});
test('an expired/blocked API returns text to Google and cannot bypass the free-credit requirement',async()=>{
 for(const reason of ['benefit_unverified','free_credit_exhausted','credit_envelope_unverified','price_unapproved_or_expired','daily_budget']){
  const h=harness('reserve',{googleBlock:null,apiBlock:reason}),r=await h.run();assert.equal(r.generation.status,'draft');assert.deepEqual(h.calls,['google']);
 }
});
test('unknown API execution remains held and is never retried through Google',async()=>{
 const h=harness('reserve',{apiOutcome:{status:'held',reason:'unknown_charge'}}),r=await h.run();assert.equal(r.generation.reason,'unknown_charge');assert.deepEqual(h.calls,['api']);
});
test('missing evidence and operator holds are not provider failures and cannot dispatch an API comparison',async()=>{
 for(const reason of ['comparison_incomplete','operator_hold','source_changed_after_reservation','paused','request_pending']){
  const h=harness('reserveComparison',{googleBlock:reason});assert.equal((await h.run()).generation.reason,reason);assert.deepEqual(h.calls,[]);
 }
});
test('model-free research continues through an attested API lane when Google capacity is unavailable',async()=>{
 let checked=0,prepared=0,plannedProvider=null;
 const store={recover:async()=>{},maintenance:async()=>({capture_allowed:true}),nextAutomaticWork:async()=>null,
  checkResearchBudget:async()=>fail('google_token_limit'),checkAPIResearchBudget:async()=>{checked++;},prepareAutomaticResearch:async p=>{prepared++;plannedProvider=p.provider;return {prepared:0};}};
 const r=await tick({store,config:{policy:editorial,sources:[],catalog:[],openai},identity,provider:async()=>assert.fail(),apiProvider:async()=>assert.fail()});
 assert.equal(checked,1);assert.equal(prepared,1);assert.equal(plannedProvider,'openai_api');assert.equal(r.generation.reason,'waiting_for_evidence');
});
test('image credit rejection is proven zero generation; other HTTP errors keep the reservation',async()=>{
 const p=apiOperationPolicy(editorial,openai,'image'),body={model:p.image_model_id,prompt:'Photo of neutral computer hardware on a workbench.',n:1,size:p.image_size,quality:p.image_quality,output_format:'webp',output_compression:80,background:'opaque',moderation:'auto'};
 for(const code of ['insufficient_quota','rate_limit_exceeded']){
  const provider=openAIProvider({apiKey:'sk-synthetic-not-a-real-key',identity,fetcher:async()=>new Response(JSON.stringify({error:{code}}),{status:429})});
  const r=await provider({id:'synthetic-image',kind:'image',policy:p,body,credit_grant:grant(),reserved_micro_usd:47120,not_after:new Date(Date.now()+180000).toISOString()});
  assert.equal(r.outcome,code==='insufficient_quota'?'not_generated':'unknown');
 }
});
test('failed source identities stay blocked while a distinct question can use the unchanged native budgets',()=>{
 const base={text:'Packet routing software describes paths, packets and network decisions. '.repeat(15),checked_at:at.toISOString(),extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,rights_reference:'public excerpt'};
 const captures=[{...base,url:'https://cloud.google.com/learn/packet-routing',title:'Packet routing software'},{...base,url:'https://azure.microsoft.com/resources/packet-routing',title:'Packet routing software',text:'Independent guide. '+base.text}];
 assert.equal(renewableExplainerPlans(captures,{at}).length,1);
 assert.equal(renewableExplainerPlans(captures,{at,failedTopics:[{pool:'tecnologia',failed:2}]}).length,1);
 assert.equal(renewableExplainerPlans(captures,{at,failedTopics:[{pool:'tecnologia',failed:2}],seedBlockedUrls:[captures[0].url,captures[1].url]}).length,0);
 assert.equal(renewableExplainerPlans(captures,{at,failedTopics:[{pool:'negocios',failed:2}]}).length,1);
});
