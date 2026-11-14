import test from 'node:test';
import assert from 'node:assert/strict';
import {explainerCatalog,validateExplainerCatalog,explainerWindowOpen,nextExplainer,automaticExplainerDossier,explainerExcerpt,explainerRecoveryEligible,explainerEvidenceHash} from '../src/explainers.mjs';
import {validateDossier,assessDossier,scopeVerified,buildComparisonRequest,explainerOverlap,validateComparison,isEvidenceGapClaim} from '../src/corroboration.mjs';
import {buildRequest,cmsDraft,validateArticle} from '../src/editorial.mjs';
import {validatePolicy,hash} from '../src/policy.mjs';
import {ARTICLE_EXTRACTION_VERSION,referenceForUrl,articleSource,extractArticle} from '../src/article-research.mjs';
import {defaultPolicy,article,candidate} from './fixtures.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';

const now=new Date('2026-11-12T15:00:00Z'),policy={...defaultPolicy,automatic_explainers_enabled:true,explainer_after_local_hour:10};
const explanatory=()=>{const d=dossierFixture(1);return {...d,event_key:'explainer:synthetic-concept-1',editorial:{kind:'explainer',key:'synthetic-concept-1',question:'Como funciona o conceito sintético usado neste teste?',as_of:now.toISOString()},documents:d.documents.map(doc=>({...doc,same_event:false,same_subject:true,excerpt_offset:0,consulted_at:now.toISOString()}))};};
test('curated explainer questions cover all ten topics, stay distinct and use separate registered authors',()=>{
  assert.ok(explainerCatalog.length>=37);assert.equal(new Set(explainerCatalog.map(p=>p.category+'/'+p.subcategory)).size,10);
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
test('recovery cannot omit or downgrade a previously unresolved critical fact to reach 90 percent',()=>{
  const d=explanatory();d.previous_critical_claims=d.claims.filter(c=>c.critical).map(({id,text})=>({id,text}));
  const request=buildComparisonRequest(d,policy);assert.deepEqual(JSON.parse(request.input).previous_critical_claims,d.previous_critical_claims);
  assert.match(request.instructions,/nunca elimine ou rebaixe/);
  assert.throws(()=>validateComparison({claims:[]},d),/critical_fact_omitted/);
  const changed=structuredClone(d.claims);changed[0].critical=false;assert.throws(()=>validateComparison({claims:changed},d),/critical_fact_omitted/);
  assert.equal(assessDossier(validateComparison({claims:d.claims},d),{comparisonVerified:true}).eligible,true);
});
test('an old excerpt gap is not a world fact, while scientific and evidential limitations remain protected',()=>{
  assert.equal(isEvidenceGapClaim('As evidências fornecidas nos textos não detalham os tipos de nuvem.'),true);
  for(const text of ['O estudo não confirma causalidade.','As evidências não confirmam a hipótese.','O experimento não concluiu a estrutura prevista.'])assert.equal(isEvidenceGapClaim(text),false);
  const d=explanatory(),claims=structuredClone(d.claims);claims[0].text='As evidências fornecidas nos textos não detalham o mecanismo.';
  assert.throws(()=>validateComparison({claims},d),/invalid_claim/);
});
test('a rejected question can refresh actual evidence once per day, without reopening written, held or exhausted work',()=>{
  const p=explainerCatalog[0],c={explainer_key:p.key,has_dossier:true,first_attempt_day:'2026-11-11',reason:'critical_fact_unresolved',attempts:1,comparisons:1,pending:false,text_attempts:false,assessment:{eligible:false}};
  assert.equal(explainerRecoveryEligible(c),true);assert.equal(nextExplainer([p],[],[c],now)?.key,p.key);
  assert.equal(explainerRecoveryEligible({...c,reason:'independence_unverified'}),true);
  for(const change of [{post_id:1},{attempts:2},{comparisons:0},{pending:true},{text_attempts:true},{reason:'operator_hold'},{assessment:{eligible:true}}])assert.equal(explainerRecoveryEligible({...c,...change}),false);
  assert.equal(nextExplainer([p],[],[{...c,artifact:{research:{day:'2026-11-12',tries:1}}}],now),null);
  const d=explanatory(),metadata=structuredClone(d);metadata.documents[0].capture_id='new-capture';metadata.documents[0].consulted_at='2026-11-12T15:01:00Z';
  assert.equal(explainerEvidenceHash(d),explainerEvidenceHash(metadata));metadata.documents[0].text+=' Fresh source context.';
  assert.notEqual(explainerEvidenceHash(d),explainerEvidenceHash(metadata));
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
test('an unrelated redirect or a lone incidental term cannot spend a comparison',()=>{
  assert.equal(explainerExcerpt('A public page about an unrelated subject. '.repeat(20),['orbital debris','collision','tracking'],1200),null);
  assert.equal(explainerExcerpt('This article mentions tracking but concerns an unrelated product. '.repeat(20),['orbital debris','collision','tracking'],1200),null);
  assert.ok(explainerExcerpt('Orbital debris and collision risks require tracking and careful context. '.repeat(20),['orbital debris','collision','tracking'],1200));
});
test('new explanatory questions replenish six missing topics without rewriting held or written questions',()=>{
  const added=explainerCatalog.slice(30,36);
  assert.equal(added.length,6);assert.equal(new Set(added.map(p=>p.category+'/'+p.subcategory)).size,6);
  assert.ok(added.every(p=>!explainerCatalog.slice(0,30).some(q=>q.key===p.key||q.question===p.question)));
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
test('late guide sections remain selectable without enlarging the provider request',()=>{
  const plan={...explainerCatalog[0],terms:['alpha','beta','gamma']};
  const captures=plan.urls.map((url,i)=>{
    const text='General introductory context. '.repeat(600)+`Reference author ${i}. Alpha beta gamma define the mechanism and its explicit limitations. `.repeat(12);
    const d=extractArticle(`<h1>Public reference guide</h1><main>${text}</main>`,url);
    return {...d,checked_at:now.toISOString(),rights_reference:'Approved public synthetic excerpt'};
  });
  const d=automaticExplainerDossier(plan,captures,policy,now);assert.ok(d);
  assert.ok(d.documents.every(doc=>doc.excerpt_offset>12000));
  for(const doc of d.documents){const c=captures.find(x=>x.url===doc.url);assert.equal([...c.text].slice(doc.excerpt_offset,doc.excerpt_offset+[...doc.text].length).join(''),doc.text);}
  assert.ok(Buffer.byteLength(JSON.stringify(buildComparisonRequest(d,policy)))+1024<=policy.input_tokens_cap_including_overhead);
  assert.equal(extractArticle(`<h1>Bounded public guide</h1><main>${'Bounded context. '.repeat(4000)}</main>`,plan.urls[0]).text.length,48000);
});
test('explanatory text has an explicit format and dates without adding invented source publication dates',()=>{
  const c={...candidate(),editorial:explanatory().editorial};c.evidence[0].published_at=null;c.evidence[0].consulted_at=now.toISOString();
  const draft=cmsDraft(c,article);assert.match(draft.body,/Artigo explicativo/);assert.match(draft.body,/data de publicação não informada/);assert.match(draft.body,/consulta em 12\/11\/2026/);
  assert.throws(()=>validateArticle({...article,title:'Google anuncia hoje uma descoberta extraordinária'},c.evidence,null,c.editorial),/explainer_false_freshness/);
  c.corroboration=assessDossier(explanatory(),{comparisonVerified:true});c.evidence[0].content_hash=hash(c.evidence[0].text);
  assert.match(buildRequest(c,policy).instructions,/FORMATO EXPLICATIVO/);
});
test('public guide landmarks and book bodies are readable without accepting arbitrary page bodies or gated text',()=>{
  const text='This public guide defines the subject and explains its context and limitations. '.repeat(8);
  for(const element of [`<div role="main">${text}</div>`,`<div class="book-content">${text}</div>`,`<div class="field-name-body">${text}</div>`])assert.ok(extractArticle(`<title>Reference guide</title><h1>Reference guide</h1>${element}`,'https://git-scm.com/book/example').text.includes('public guide'));
  const google=`<title>Cloud reference guide</title><body><nav>Navigation is excluded</nav><h1>Cloud reference guide</h1><section class="cws-jump-section">${text}</section></body>`;
  assert.ok(extractArticle(google,'https://cloud.google.com/learn/example').text.includes('public guide'));
  assert.throws(()=>extractArticle(google,'https://cloud.google.com/unrelated/example'),/research_article_missing/);
  assert.throws(()=>extractArticle('<script type="application/ld+json">{"@type":"Article","isAccessibleForFree":false}</script>'+google,'https://cloud.google.com/learn/example'),/research_access_restricted/);
  assert.ok(extractArticle(`<h1>What is a neuron?</h1><div class="field-name-field-uq-basic-body">${text}</div>`,'https://qbi.uq.edu.au/brain/example').text.includes('public guide'));
  assert.ok(extractArticle(`<h1>Git guide</h1><div id="main" class="book edition2">${text}</div>`,'https://git-scm.com/book/example').text.includes('public guide'));
});
test('ESA guide context wins over unrelated recommendation articles, and Azure chapters stay together',()=>{
  const first='This public guide describes the actual phenomenon and its documented context. '.repeat(8);
  const second='This later section explains the mechanism, application and limitations. '.repeat(8);
  const esa=`<h1>Official eclipse guide</h1><main><section class="articles-modules articles-modules__text-image">${first}</section><section class="articles-modules articles-modules__text-image">${second}</section><article data-card-link="https://www.esa.int/unrelated">${'Unrelated recommended story. '.repeat(50)}</article><div class="interactive-media-modal">${'Modal control. '.repeat(40)}</div></main>`;
  const d=extractArticle(esa,'https://www.esa.int/articles/official-guide');
  assert.ok(d.text.includes(first.trim()));assert.ok(d.text.includes(second.trim()));assert.equal(d.text.includes('Unrelated recommended'),false);assert.equal(d.text.includes('Modal control'),false);
  const azure=`<h1>Public cloud guide</h1><main><article class="editorial-article__main">${first}</article><article class="editorial-article__main">${second}</article><article>${'Recommended commercial product. '.repeat(40)}</article></main>`;
  const a=extractArticle(azure,'https://azure.microsoft.com/en-us/resources/cloud-computing-dictionary/example/');
  assert.ok(a.text.includes(first.trim()));assert.ok(a.text.includes(second.trim()));assert.equal(a.text.includes('Recommended commercial product'),false);
  assert.throws(()=>extractArticle('<script type="application/ld+json">{"@type":"Article","isAccessibleForFree":false}</script>'+esa,'https://www.esa.int/articles/official-guide'),/research_access_restricted/);
});
test('Intel public support body excludes menus and product recommendations',()=>{
  const prose='Integrated graphics shares system memory, while discrete graphics has dedicated memory. '.repeat(6);
  const html=`<h1>Public GPU guide</h1><div id="articleSFBody" data-component="articleSFBody">${prose}</div><div>${'Unrelated product list. '.repeat(100)}</div>`;
  assert.equal(extractArticle(html,'https://www.intel.com/content/www/us/en/support/articles/000057824/graphics.html').text,prose.trim());
  assert.throws(()=>extractArticle(html,'https://other.org/guide'),/research_article_missing/);
});
