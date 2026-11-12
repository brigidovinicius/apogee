import test from 'node:test';
import assert from 'node:assert/strict';
import {explainerCatalog,validateExplainerCatalog,explainerWindowOpen,nextExplainer,automaticExplainerDossier,explainerExcerpt} from '../src/explainers.mjs';
import {validateDossier,assessDossier,scopeVerified,buildComparisonRequest,explainerOverlap} from '../src/corroboration.mjs';
import {buildRequest,cmsDraft,validateArticle} from '../src/editorial.mjs';
import {validatePolicy,hash} from '../src/policy.mjs';
import {ARTICLE_EXTRACTION_VERSION,referenceForUrl,articleSource} from '../src/article-research.mjs';
import {defaultPolicy,article,candidate} from './fixtures.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';

const now=new Date('2026-11-12T15:00:00Z'),policy={...defaultPolicy,automatic_explainers_enabled:true,explainer_after_local_hour:10};
const explanatory=()=>{const d=dossierFixture(1);return {...d,event_key:'explainer:synthetic-concept-1',editorial:{kind:'explainer',key:'synthetic-concept-1',question:'Como funciona o conceito sintético usado neste teste?',as_of:now.toISOString()},documents:d.documents.map(doc=>({...doc,same_event:false,same_subject:true,excerpt_offset:0,consulted_at:now.toISOString()}))};};
test('curated explainer questions cover all ten topics, stay distinct and use separate registered authors',()=>{
  assert.equal(explainerCatalog.length,30);assert.equal(new Set(explainerCatalog.map(p=>p.category+'/'+p.subcategory)).size,10);
  assert.throws(()=>validateExplainerCatalog([...explainerCatalog,explainerCatalog[0]]),/invalid_explainer_catalog/);
  assert.throws(()=>validateExplainerCatalog([{...explainerCatalog[0],urls:['https://www.nasa.gov/a','https://www.nasa.gov/b']}]),/invalid_explainer_sources/);
  assert.throws(()=>validateExplainerCatalog([{...explainerCatalog[0],urls:['https://127.0.0.1/a','https://www.esa.int/b']}]),/invalid_reference_url/);
});
test('hybrid window is in Brasilia and never enlarges existing consumption limits',()=>{
  assert.equal(explainerWindowOpen(policy,new Date('2026-11-12T12:59:59Z')),false);
  assert.equal(explainerWindowOpen(policy,new Date('2026-11-12T13:00:00Z')),true);
  assert.equal(explainerWindowOpen({...policy,automatic_explainers_enabled:false},now),false);
  validatePolicy(policy);
  for(const change of [{explainer_after_local_hour:0},{explainer_after_local_hour:21},{google_daily_calls_cap:41},{google_use_g1_credits:true}])assert.throws(()=>validatePolicy({...policy,...change}));
});
test('daily and weekly topic slots, used questions, holds and backoff cannot be bypassed',()=>{
  const plans=explainerCatalog.slice(0,2),p=plans[0];
  assert.equal(nextExplainer(plans,[{...p,day:1,week:1}],[],now).key,plans[1].key);
  assert.equal(nextExplainer(plans,[{...p,day:0,week:7}],[],now).key,plans[1].key);
  for(const state of [{post_id:1},{first_attempt_day:'2026-11-12'},{has_dossier:true},{reason:'operator_hold'},{artifact:{research:{next_at:'2026-11-12T16:00:00Z'}}}])assert.equal(nextExplainer(plans,[],[{explainer_key:p.key,...state}],now).key,plans[1].key);
});
test('same subject never impersonates a same-event news validation',()=>{
  const d=explanatory();assert.equal(scopeVerified(d),true);assert.equal(assessDossier(d,{comparisonVerified:true}).eligible,true);
  assert.equal(scopeVerified({...d,editorial:undefined}),false);
  const pending=structuredClone(d);pending.documents[1].same_subject=false;assert.ok(assessDossier(pending,{comparisonVerified:true}).blockers.includes('subject_unverified'));
  const malformed=structuredClone(d);malformed.documents[1].same_event=true;assert.throws(()=>validateDossier(malformed),/invalid_explainer_document/);
  const wrongKey=structuredClone(d);wrongKey.editorial.key='another-subject';assert.throws(()=>validateDossier(wrongKey),/invalid_explainer_scope/);
  const request=buildComparisonRequest(d,policy);assert.equal(JSON.parse(request.input).editorial.question,d.editorial.question);assert.match(request.instructions,/FORMATO EXPLICATIVO/);
});
test('explainer still rejects 89 percent, a critical disagreement, and nonliteral quotations',()=>{
  const d=explanatory();const ten=dossierFixture(10,9);d.claims=ten.claims;assert.equal(assessDossier(d,{comparisonVerified:true}).percentage,90);
  d.claims[1].cells[1].status='not_mentioned';d.claims[1].cells[1].quote='';assert.ok(assessDossier(d,{comparisonVerified:true}).blockers.includes('compatibility_below_90'));
  d.claims[0].cells[1].status='contradicts';assert.ok(assessDossier(d,{comparisonVerified:true}).blockers.includes('critical_fact_unresolved'));
  d.claims[0].cells[1].quote='An invented quote';assert.throws(()=>assessDossier(d),/quote_not_in_document/);
});
test('a subject excerpt remains contiguous and records Unicode character offsets',()=>{
  const text='🛰️ Contexto inicial. '+('Contexto sem o assunto principal. '.repeat(80))+'O modelo conceitual usa alpha, beta e gamma com limites explícitos. '+('Uma sequência de contexto completo e ressalvas. '.repeat(10));
  const result=explainerExcerpt(text,['alpha','beta','gamma'],600);assert.ok(result.excerpt_offset>0);
  assert.ok(result.text.includes('alpha'));assert.equal([...text].slice(result.excerpt_offset,result.excerpt_offset+[...result.text].length).join(''),result.text);
});
test('old source dates stay old; stale captures cannot produce an explanatory dossier',()=>{
  const plan=explainerCatalog[0],text=('Electromagnetic spectrum includes visible light, radio and infrared. Context and limits remain documented. ').repeat(15);
  const captures=plan.urls.map((url,i)=>({...articleSource(referenceForUrl(url)),url,title:'Public synthetic reference guide',text:'Synthetic author '+i+'. '+text,published_at:'2015-03-01T12:00:00Z',rights_reference:'Approved synthetic public excerpt',extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,checked_at:now.toISOString()}));
  const d=automaticExplainerDossier(plan,captures,policy,now);assert.ok(d);assert.ok(d.documents.every(doc=>doc.published_at.startsWith('2015')&&doc.consulted_at===now.toISOString()&&!doc.same_event));
  assert.equal(automaticExplainerDossier(plan,captures,policy,new Date(+now+86400001)),null);
  assert.equal(automaticExplainerDossier(plan,captures.map(s=>({...s,text})),policy,now),null,'Two exact republications are never independent guides');
});
test('new questions cannot recycle most of the critical evidence of an existing explainer',()=>{
  const d=explanatory();assert.equal(explainerOverlap(d,[d]),true);
  const different=structuredClone(d);different.claims[0].cells= different.claims[0].cells.map(c=>({...c,quote:'A análise independente discute limitações de método.'}));
  assert.equal(explainerOverlap(d,[different]),false);
});
test('explanatory text has an explicit format and dates without adding invented source publication dates',()=>{
  const c={...candidate(),editorial:explanatory().editorial};c.evidence[0].published_at=null;c.evidence[0].consulted_at=now.toISOString();
  const draft=cmsDraft(c,article);assert.match(draft.body,/Artigo explicativo/);assert.match(draft.body,/data de publicação não informada/);assert.match(draft.body,/consulta em 12\/11\/2026/);
  assert.throws(()=>validateArticle({...article,title:'Google anuncia hoje uma descoberta extraordinária'},c.evidence,null,c.editorial),/explainer_false_freshness/);
  c.corroboration=assessDossier(explanatory(),{comparisonVerified:true});c.evidence[0].content_hash=hash(c.evidence[0].text);
  assert.match(buildRequest(c,policy).instructions,/FORMATO EXPLICATIVO/);
});
