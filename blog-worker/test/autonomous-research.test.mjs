import test from 'node:test';
import assert from 'node:assert/strict';
import {quoteUnits,resolveComparisonQuotes,buildComparisonRequest,comparisonPrompt,validateComparison,referenceUrl} from '../src/corroboration.mjs';
import {explainerCatalog,expandExplainerSources,editorialAttemptLimit,explainerRecoveryEligible,nextExplainer} from '../src/explainers.mjs';
import {referenceForUrl,primaryReference} from '../src/article-research.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';
import {defaultPolicy} from './fixtures.mjs';

test('source quote IDs preserve complete context, Unicode and literal source text',()=>{
 const doc={id:'E1',text:('This sentence preserves context and uncertainty. 🛰️ Another sentence includes its limitation. ').repeat(15)+'End.'};
 const units=quoteUnits(doc);assert.ok(units.length>3);
 assert.equal(units.map(q=>q.text).join(' ').replace(/\s+/g,''),doc.text.replace(/\s+/g,''));
 assert.ok(units.every((q,i)=>q.id==='E1Q'+(i+1)&&doc.text.includes(q.text)&&q.text.length>=8));
 assert.ok(units.every(q=>!/[\ud800-\udbff]$/.test(q.text)));
 const d=dossierFixture(),quote=quoteUnits(d.documents[0])[0];
 const value={claims:[{id:'C1',text:'The synthetic statement is retained without changing its status.',critical:true,cells:[{document_id:'E1',status:'supports',quote_id:quote.id,note:''},{document_id:'E2',status:'not_mentioned',quote_id:'none',note:''}]}]};
 const normalized=resolveComparisonQuotes(value,d);assert.equal(normalized.claims[0].cells[0].quote,quote.text);assert.equal(normalized.claims[0].cells[1].quote,'');
 assert.equal(value.claims[0].cells[0].quote_id,quote.id);
 for(const mutation of [v=>{v.claims[0].cells[0].quote_id='E2Q1';},v=>{v.claims[0].cells[0].quote_id='none';},v=>{v.claims[0].cells[1].quote_id='E2Q1';},v=>{v.claims[0].cells[0].quote='invented';}]){
  const v=structuredClone(value);mutation(v);assert.throws(()=>resolveComparisonQuotes(v,d),/invalid_quote_reference|invalid_claim_cell/);
 }
});
test('the comparison schema uses exact source IDs and never duplicates source prose',()=>{
 const d=dossierFixture(),request=buildComparisonRequest(d,defaultPolicy),input=JSON.parse(request.input),cell=request.text.format.schema.properties.claims.items.properties.cells.items;
 assert.ok(cell.required.includes('quote_id'));assert.equal(cell.properties.quote,undefined);assert.ok(new RegExp(cell.properties.quote_id.pattern).test('E1Q1'));
 assert.equal(input.documents[0].text,undefined);assert.ok(Object.keys(input.documents[0].quote_units).length);
 assert.ok(Buffer.byteLength(JSON.stringify(request))+1024<=defaultPolicy.input_tokens_cap_including_overhead);
 const google={...defaultPolicy,provider:'google_subscription'},native=buildComparisonRequest(d,google);assert.ok(Buffer.byteLength(comparisonPrompt(native))+1024<=google.input_tokens_cap_including_overhead);
});
test('scoped project references never authorize an unrelated repository or dynamic endpoint',()=>{
 const url='https://github.com/Dodaios/ste80-humanizer',ref=referenceForUrl(url);assert.ok(primaryReference(ref));
 assert.equal(referenceForUrl('https://github.com/Dodaios/other-project'),null);assert.equal(referenceForUrl(url+'/issues'),null);
 assert.throws(()=>referenceUrl(url+'/issues',ref),/unapproved_reference_path/);
 assert.equal(referenceUrl(url+'#readme',ref),url);
});
test('recovery expands registered primary evidence without recycling a publisher or promoting unknown links',()=>{
 const plan=explainerCatalog.find(p=>p.key==='escrita-tecnica-aeronautica-prompts-ia-1');
 const expanded=expandExplainerSources(plan,[{url:plan.urls[0],related_urls:['https://unregistered.invalid/unsafe','https://github.com/Dodaios/other-project']}]);
 assert.equal(expanded.key,plan.key);assert.equal(expanded.question,plan.question);assert.equal(expanded.urls.length,5);
 assert.deepEqual(expanded.urls.slice(0,3),plan.urls);assert.equal(expanded.provenance[2].kind,'derivative');assert.equal(expanded.provenance[2].origin_url,expanded.provenance[0].origin_url);
 assert.equal(new Set(expanded.urls.map(u=>referenceForUrl(u).publisher)).size,5);
});
test('a fourth editorial operation requires the exact confirmed format and factual receipts',()=>{
 const policy={...defaultPolicy,provider:'google_subscription',schema_version:3,max_provider_attempts_per_article_including_repairs:3};
 const dossier={recovery:{maximum_editorial_attempts:4,comparison_attempt_id:'valid',prior_format_attempt_id:'format'}};
 const attempts=[{id:'valid',kind:'comparison',state:'confirmed',reason:null},{id:'format',kind:'comparison',state:'confirmed',reason:'quote_not_in_document'}];
 assert.equal(editorialAttemptLimit(policy,dossier,attempts),4);
 for(const changed of [[],attempts.slice(0,1),attempts.map(a=>({...a,state:'unknown'})),attempts.map(a=>({...a,reason:null}))])assert.equal(editorialAttemptLimit(policy,dossier,changed),3);
 assert.equal(editorialAttemptLimit({...policy,provider:'openai_api'},dossier,attempts),3);
 const plan=explainerCatalog[0],c={explainer_key:plan.key,has_dossier:true,first_attempt_day:'2026-11-16',reason:'compatibility_below_90',attempts:2,comparisons:2,format_failures:1,pending:false,text_attempts:false,assessment:{eligible:false}};
 assert.equal(nextExplainer([explainerCatalog[1],plan],[],[c],new Date('2026-11-16T15:00:00Z')),plan);
 assert.equal(explainerRecoveryEligible(c),true);assert.equal(explainerRecoveryEligible({...c,format_failures:0}),false);assert.equal(explainerRecoveryEligible({...c,text_attempts:true}),false);
 assert.equal(nextExplainer([plan],[],[{...c,artifact:{research:{recovery_day:'2026-11-16',recovery_tries:3}}}],new Date('2026-11-16T15:00:00Z')),null);
});
test('recovery cannot delete a noncritical unresolved fact to make the percentage pass',()=>{
 const d=dossierFixture();d.editorial={kind:'explainer',key:'synthetic-concept-1',question:'How does the synthetic concept work and what are its limits?',as_of:new Date().toISOString()};d.event_key='explainer:synthetic-concept-1';
 d.documents=d.documents.map(doc=>({...doc,same_event:false,same_subject:true,excerpt_offset:0,consulted_at:new Date().toISOString()}));
 d.previous_unresolved_claims=[{id:'C9',text:'The unresolved synthetic fact must stay visible in the next comparison.',critical:false}];
 assert.throws(()=>validateComparison({claims:d.claims},d),/previous_fact_omitted/);
 assert.throws(()=>validateComparison({claims:[...d.claims,{...d.claims[0],id:'C9',text:'A different claim would hide the earlier uncertainty.'}]},d),/previous_fact_omitted/);
});


test('native tabular transport preserves every source field and quote without expanding the ceiling',()=>{
 const d=dossierFixture();d.claims=[];d.documents.push(...d.documents.map((doc,i)=>({...doc,id:'E'+(i+3),url:doc.url+'other',origin_url:doc.origin_url+'other'})));
 const request=buildComparisonRequest(d,{...defaultPolicy,input_tokens_cap_including_overhead:20000});
 const original=JSON.parse(request.input),sent=JSON.parse(comparisonPrompt(request).split('\n').at(-1));
 assert.ok(sent.document_columns.length);assert.deepEqual(sent.documents.map(row=>Object.fromEntries(sent.document_columns.map((key,i)=>[key,row[i]]))),original.documents);
 assert.ok(Buffer.byteLength(comparisonPrompt(request))<Buffer.byteLength(request.instructions+'\nSchema: '+JSON.stringify(request.text.format.schema)+'\n'+request.input));
});
