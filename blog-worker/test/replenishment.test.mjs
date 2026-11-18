import test from 'node:test';
import assert from 'node:assert/strict';
import {renewableExplainerPlans,storedExplainerPlans,nextReferenceDiscovery} from '../src/replenishment.mjs';
import {ARTICLE_EXTRACTION_VERSION} from '../src/article-research.mjs';
import {FOCUSED_EDITORIAL_PLAN} from '../../make-it-fly-current/lib/blog/editorial-plan.mjs';
import {validateComparison,assessDossier} from '../src/corroboration.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';
import {tick} from '../src/worker.mjs';
import {defaultPolicy} from './fixtures.mjs';
import {fail} from '../src/policy.mjs';

const at=new Date('2026-11-17T15:00:00Z'),policy={editorial_focus:FOCUSED_EDITORIAL_PLAN};
const doc=(url,title,source_id,author)=>({url,title,source_id,text:(author+' documents '+title+' with specific context, mechanisms, limitations and public sources. ').repeat(10),
 extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,checked_at:at.toISOString(),published_at:null,rights_reference:'Public excerpt for attribution; no image licence',related_urls:[]});
const pair=(subject='Packet routing software')=>[
 doc('https://cloud.google.com/learn/packet-routing',subject,'ARTICLE_PRIMARY_GOOGLE_EDUCATION','First author'),
 doc('https://azure.microsoft.com/en-us/resources/packet-routing',subject,'ARTICLE_PRIMARY_MICROSOFT_EDUCATION','Second author')];

test('new public captures replenish the queue after a fixed catalog is exhausted, with stable identities and provenance',()=>{
 const captures=pair(),[p]=renewableExplainerPlans(captures,{policy,at});assert.ok(p);
 assert.equal(p.category,'tecnologia');assert.equal(p.urls.length,2);assert.equal(p.provenance[0].kind,'primary');assert.equal(p.provenance[1].kind,'independent');
 assert.equal(renewableExplainerPlans(captures,{policy,at}).length,1,'reversing primary and peer cannot create a second topic');
 assert.equal(renewableExplainerPlans(captures,{policy,at,existing:[{explainer_key:p.key}]}).length,0);
 assert.equal(renewableExplainerPlans(captures,{policy,at,blockedUrls:[captures[0].url]}).length,0,'a held or written source cannot get a new candidate identity');
 assert.equal(renewableExplainerPlans([{...captures[0],requested_url:'https://cloud.google.com/learn/old-routing'},captures[1]],{policy,at,blockedUrls:['https://cloud.google.com/learn/old-routing']}).length,0,'a redirected held source cannot get a new identity');
 assert.equal(renewableExplainerPlans(captures,{policy,at,usage:[{category:'tecnologia',subcategory:'software-ferramentas',day:4,week:4}]}).length,0);
});
test('discovery does not treat unrelated stories, copied text, unapproved hosts or stale snapshots as corroboration',()=>{
 const [a,b]=pair();
 for(const changed of [{...b,title:'Agriculture and fishing'}, {...b,text:a.text}, {...b,url:'https://unknown.test/article'}, {...b,checked_at:'2026-11-01T00:00:00Z'}, {...b,published_at:'2026-12-01T00:00:00Z'}, {...b,extraction_version:'old-extractor'}])
  assert.equal(renewableExplainerPlans([a,changed],{policy,at}).length,0);
 assert.equal(renewableExplainerPlans([a,{...b,title:'Google Microsoft official guide',text:'A different guide. '.repeat(50)}],{policy,at}).length,0);
 assert.equal(renewableExplainerPlans(pair('Strategic partnership announcement'),{policy,at}).length,0,'shared announcement vocabulary is not a shared subject');
});
test('a persisted plan is revalidated after restart and never substitutes another key or an unregistered path',()=>{
 const [plan]=renewableExplainerPlans(pair(),{policy,at});
 assert.equal(storedExplainerPlans([{explainer_key:plan.key,artifact:{research:{plan}}}]).length,1);
 for(const altered of [{...plan,key:'auto-other-key'},{...plan,urls:['https://127.0.0.1/a',plan.urls[1]]},{...plan,provenance:[]}, {...plan,terms:['']}])
  assert.equal(storedExplainerPlans([{explainer_key:plan.key,artifact:{research:{plan:altered}}}]).length,0);
});
test('used educational context cannot become a new seed but can support a distinct new guide',()=>{
 const [a,b]=pair('IaaS infrastructure software'),fresh={...a,url:a.url+'-new-context'};
 const [old]=renewableExplainerPlans([a,b],{policy,at});
 const result=renewableExplainerPlans([fresh,b],{policy,at,existing:[{explainer_key:old.key}],seedBlockedUrls:[a.url,b.url]});
 assert.equal(result.length,1);assert.equal(result[0].urls[0],fresh.url);
 assert.equal(renewableExplainerPlans([fresh,b],{policy,at,blockedUrls:[b.url],seedBlockedUrls:[a.url,b.url]}).length,0,'a held reference remains unavailable even as context');
 assert.equal(renewableExplainerPlans([a,b],{policy,at,seedBlockedUrls:[a.url,b.url]}).length,0,'a used source cannot get a replacement identity');
});
test('renewable explainers do not relabel a corporate news announcement',()=>{
 const captures=[doc('https://blog.google/products/new-iaas','IaaS infrastructure software','ARTICLE_PRIMARY_GOOGLE_BLOG','Corporate announcement'),pair('IaaS infrastructure software')[1]];
 const plans=renewableExplainerPlans(captures,{policy,at});
 assert.ok(plans.every(p=>!p.urls[0].startsWith('https://blog.google/')));
 const [plan]=renewableExplainerPlans(pair(),{policy,at});
 assert.deepEqual(storedExplainerPlans([{explainer_key:plan.key,artifact:{research:{plan:{...plan,urls:[captures[0].url,plan.urls[1]]}}}}]),[]);
});
test('new observed educational links outrank an exhausted parent refresh',()=>{
 const [parent]=pair();const url='https://cloud.google.com/learn/what-is-iaas';
 const old={...parent,extraction_version:'old-extractor',related_urls:[url]};
 const selected=nextReferenceDiscovery([old],{policy,at,seedBlockedUrls:[parent.url]});
 assert.equal(selected.url,url);assert.equal(selected.refresh_parent,undefined);
 const news={...old,url:'https://blogs.nvidia.com/blog/synthetic-hardware',source_id:'ARTICLE_PRIMARY_NVIDIA',title:'Synthetic hardware processor',related_urls:[]};
 assert.equal(nextReferenceDiscovery([news,old],{policy,at,attemptedUrls:['https://cloud.google.com/learn/already-read']}).url,url,'a lower-priority publisher cannot put exhausted refreshes ahead of new guides');
 assert.equal(nextReferenceDiscovery([old],{policy,at,attemptedUrls:[url]}).url,parent.url,'failed links stay in cooldown; parent refresh is still a bounded fallback');
 assert.equal(renewableExplainerPlans([old,...pair().slice(1)],{policy,at}).length,0,'historical link metadata is never comparison evidence');
});
test('reference discovery follows an observed registered link and preserves failed-link cooldowns without a search API',()=>{
 const [parent]=pair();parent.related_urls=['https://unknown.invalid/learn/ai','https://cloud.google.com/learn/new-software-routing','https://cloud.google.com/privacy'];
 const selected=nextReferenceDiscovery([parent],{policy,at});assert.equal(selected.url,parent.related_urls[1]);
 assert.equal(nextReferenceDiscovery([parent],{policy,at,attemptedUrls:[selected.url]}),null);
 assert.equal(nextReferenceDiscovery([parent],{policy,at,blockedUrls:[selected.url]}),null);
 assert.equal(nextReferenceDiscovery([parent],{policy,at,approvedReferenceIds:[]}),null);
 assert.equal(nextReferenceDiscovery([parent],{policy,at,approvedReferenceIds:['ARTICLE_PRIMARY_GOOGLE_EDUCATION']}).url,selected.url);
 const other='https://azure.microsoft.com/en-us/resources/novel-software-routing';
 assert.equal(nextReferenceDiscovery([{...parent,related_urls:[selected.url,other]}],{policy,at,isApproved:url=>url===other}).url,other,'a disabled path must not starve another approved source');
 assert.equal(nextReferenceDiscovery([{...parent,related_urls:['https://cloud.google.com/learn/%E0%A4%A']}],{policy,at}),null);
 const old={...parent,extraction_version:'public-article-v5-complete-guides',related_urls:[]};
 const refresh=nextReferenceDiscovery([old],{policy,at,blockedUrls:[old.url]});
 assert.equal(refresh.url,old.url);assert.equal(refresh.refresh_parent,true);
 assert.equal(nextReferenceDiscovery([old],{policy,at,attemptedUrls:[old.url]}),null);
 assert.equal(renewableExplainerPlans([old,...pair().slice(1)],{policy,at}).length,0,'a refresh lead is never current factual evidence');
});
test('news recovery cannot remove a critical fact or an unresolved fact to manufacture 90 percent',()=>{
 const d=dossierFixture(2);d.previous_critical_claims=d.claims.filter(c=>c.critical).map(({id,text})=>({id,text}));
 d.previous_unresolved_claims=d.claims.map(({id,text,critical})=>({id,text,critical}));
 assert.equal(assessDossier(validateComparison({claims:d.claims},d),{comparisonVerified:true}).eligible,true);
 assert.throws(()=>validateComparison({claims:d.claims.slice(1)},d),/critical_fact_omitted|previous_fact_omitted/);
 const altered=structuredClone(d.claims);altered[0].critical=false;
 assert.throws(()=>validateComparison({claims:altered},d),/critical_fact_omitted/);
});
test('public source discovery continues without a model call when the Google token budget is held',async()=>{
 let reads=0,calls=0;
 const store={recover:async()=>{},maintenance:async()=>({capture_allowed:true}),nextAutomaticWork:async()=>null,
  prepareRenewableResearch:async(_p,options)=>{assert.equal(options.discoveryOnly,true);reads++;return {prepared:0,kind:'reference_discovery',requests:2,reason:'reference_captured'};},
  checkResearchBudget:async()=>fail('google_token_limit'),prepareAutomaticResearch:async()=>assert.fail('the same tick cannot start a second network research')};
 const result=await tick({store,identity:{},config:{sources:[],catalog:[],policy:{...defaultPolicy,generation_enabled:true,operator_commands_only:false,automatic_explainers_enabled:true,google_account_email:'blog-owner@example.test'}},provider:async()=>{calls++;}});
 assert.equal(reads,1);assert.equal(calls,0);assert.equal(result.research.requests,2);assert.equal(result.generation.reason,'google_token_limit');
});
