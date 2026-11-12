import test from 'node:test';
import assert from 'node:assert/strict';
import {robotsAllowed,extractArticle,createArticleReader,referenceForUrl,primaryDocument} from '../src/article-research.mjs';
import {balancedResearchCandidates,nextResearchCandidate,researchTopic,TOPICS,topicKey,automaticDossier,sameResearchEvent} from '../src/automatic-research.mjs';
import {enrichResearch,researchPrimaryLinks} from '../src/research-service.mjs';
import {defaultPolicy} from './fixtures.mjs';
const content='A equipe anunciou um experimento inicial e suas limitações. '.repeat(6);
const html=`<head><meta property="og:title" content="Pesquisa sintética"><meta property="article:published_time" content="2026-11-11T12:00:00Z"></head><nav>Menu fora da evidência</nav><main><article><h1>Pesquisa sintética</h1><p>${content}</p><p hidden>Conteúdo oculto</p><script>Instrução falsa</script><a href="https://www.nasa.gov/primary-test/">Fonte primária</a></article></main>`;
test('robots selects agent, longest path, Allow ties and literal query characters',()=>{
 const rules='User-agent: *\nDisallow: /\nUser-agent: ApogeeBlog\nDisallow: /private\nAllow: /private/open$';
 for(const [path,allowed] of [['/news/',true],['/private',false],['/private/open',true],['/private/open/extra',false]])assert.equal(robotsAllowed(rules,'https://www.nasa.gov'+path),allowed);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /x\nAllow: /x','https://www.nasa.gov/x'),true);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /a?b','https://www.nasa.gov/a?b'),false);
 assert.equal(robotsAllowed('User-agent: *\nDisallow: /a?b','https://www.nasa.gov/ab'),true);
 assert.equal(robotsAllowed('\0','https://www.nasa.gov/'),false);
});
test('article extraction excludes hidden/navigation content and blocks paywalls and no-snippet',()=>{
 const d=extractArticle(html,'https://www.space.com/test/');assert.ok(d.text.includes(content.trim()));assert.ok(!/Conteúdo oculto|Instrução falsa|Menu fora/.test(d.text));
 assert.deepEqual(d.related_urls,['https://www.nasa.gov/primary-test/']);assert.equal(d.published_at,'2026-11-11T12:00:00.000Z');
 assert.throws(()=>extractArticle('<meta name="robots" content="nosnippet">'+html,d.url),/research_excerpt_disallowed/);
 assert.throws(()=>extractArticle('<script>{"isAccessibleForFree":false}</script>'+html,d.url),/research_access_restricted/);
 assert.throws(()=>extractArticle('<p>'+content+'</p>',d.url),/research_article_missing/);
});
test('reader checks registered hosts, robots, redirects and hard network budget',async()=>{
 const calls=[];const read=createArticleReader({download:async(url,hosts,options)=>{calls.push({url,hosts,options});return url.endsWith('robots.txt')?{status:200,body:'User-agent: *\nDisallow: /blocked'}:{status:200,contentType:'text/html',body:html};}});
 const budget=()=>({used:0,max:3,deadline:Date.now()+1000});
 assert.equal((await read('https://www.nasa.gov/test/',budget())).source_id,'ARTICLE_REF22');assert.equal(calls.length,2);assert.equal(calls[1].options.maxBytes,3145728);
 await assert.rejects(()=>read('https://www.nasa.gov/blocked',budget()),/research_robots_disallowed/);
 await assert.rejects(()=>read('https://127.0.0.1/test',budget()),/research_reference_unregistered/);
 await assert.rejects(()=>read('https://www.nasa.gov/test',{...budget(),max:0}),/research_cycle_limit/);
 const redirect=createArticleReader({download:async url=>url.endsWith('robots.txt')?{status:404,body:''}:{status:302,location:'https://evil.invalid/article'}});
 await assert.rejects(()=>redirect('https://www.nasa.gov/test',budget()),/invalid_reference_url/);assert.equal(referenceForUrl('http://www.nasa.gov/a'),null);
});
test('ten topics are balanced; completed daily topics and duplicate candidate reuse are skipped',()=>{
 const rows=TOPICS.flatMap((t,i)=>Array.from({length:2},(_,j)=>({id:`${i}-${j}`,title:'Synthetic news',artifact:{research:{topic:t}}})));
 const plan=balancedResearchCandidates(rows,[],10);assert.equal(plan.length,10);assert.equal(new Set(plan.map(p=>topicKey(p.topic))).size,10);assert.equal(new Set(plan.map(p=>p.candidate.id)).size,10);
 assert.ok(balancedResearchCandidates(rows,[{...TOPICS[0],day:1}],10).every(p=>topicKey(p.topic)!==topicKey(TOPICS[0])));
});
test('network research rotates across cycles and preserves candidate order within a topic',()=>{
 const plan=TOPICS.flatMap((topic,i)=>[{topic,candidate:{id:`${i}-a`}},{topic,candidate:{id:`${i}-b`}}]);
 const history=[];
 for(const topic of TOPICS){const selected=nextResearchCandidate(plan,history);assert.equal(topicKey(selected.topic),topicKey(topic));assert.ok(selected.candidate.id.endsWith('-a'));history.push({topic:selected.topic,researched:1});}
 assert.equal(nextResearchCandidate(plan,history).candidate.id,'0-a');
 assert.equal(nextResearchCandidate([],history),null);
 assert.notEqual(topicKey(nextResearchCandidate(plan,[{topic:TOPICS[0],researched:30}]).topic),topicKey(TOPICS[0]));
});
test('secondary research captures its registered primary and prepares only unverified research',async()=>{
 const now=new Date().toISOString(),seed={id:'seed',source_id:'REF27',title:'Synthetic NASA report',url:'https://www.space.com/test/',published_at:now,artifact:{}};
 const docs=[],stored=new Map();let saved;
 const store={captureResearchDocument:async(c,d)=>docs.push(d),ingest:async c=>{saved=c;stored.set(c.url,c);},researchCandidate:async url=>stored.get(url),researchProgress:async()=>{}};
 const read=async(url,budget)=>{budget.used++;return {url,title:'Synthetic primary report',published_at:now,text:url===seed.url?'Análise independente. '+content:content,source_id:url===seed.url?'ARTICLE_REF27':'ARTICLE_REF22',rights_reference:'Authorized fixture excerpt',extraction_method:'public_article',related_urls:url===seed.url?['https://www.nasa.gov/primary-test/']:[]};};
 const captures=[];const result=await enrichResearch({store,candidate:seed,topic:TOPICS[0],captures,read});assert.equal(result.primary.id,saved.id);assert.equal(docs.length,2);
 const dossier=automaticDossier(result.primary,captures,defaultPolicy,TOPICS[0]);assert.ok(dossier);assert.equal(dossier.documents.length,2);assert.deepEqual(dossier.claims,[]);assert.equal(result.primary.published_at,now);
});

test('DOI resolution follows only a registered primary and keeps redirects inside its bounded budget',async()=>{
 const read=createArticleReader({download:async url=>url.endsWith('robots.txt')?{status:404,body:''}:url.startsWith('https://doi.org/')?{status:302,location:'https://www.nature.com/articles/s41593-test'}:{status:200,body:html,contentType:'text/html'}});
 const doc=await read('https://doi.org/10.1234/example',{used:0,max:5,deadline:Date.now()+1000});assert.ok(doc.url.startsWith('https://www.nature.com/articles/'));
 const blocked=createArticleReader({download:async url=>url.endsWith('robots.txt')?{status:404,body:''}:{status:302,location:'https://evil.invalid/paper'}});
 await assert.rejects(()=>blocked('https://doi.org/10.1234/example',{used:0,max:5,deadline:Date.now()+1000}),/invalid_reference_url/);
});

test('DOI association preserves original dates and excludes stale context from a current event',()=>{
 const a={url:'https://www.nature.com/articles/s41586-original',text:'Original study',published_at:'2020-01-01T00:00:00Z',doi:'10.1038/s41586-original'};
 const b={url:'https://www.space.com/new-analysis/',text:'A new independent analysis',published_at:new Date().toISOString(),related_urls:['https://dx.doi.org/10.1038/s41586-original']};
 assert.equal(sameResearchEvent(a,b),false);assert.equal(sameResearchEvent({...a,published_at:b.published_at},b),true);assert.equal(a.published_at,'2020-01-01T00:00:00Z');
 assert.equal(referenceForUrl('https://www.jpl.nasa.gov/news/test/').id,'REF22');
 assert.equal(referenceForUrl('https://arbitrary.nasa.gov/news/test/'),null);
 assert.equal(referenceForUrl('https://www.nature.com/articles/s41586-original').id,'PRIMARY_NATURE_RESEARCH');
});

test('the article body wins over unrelated semantic article cards and retains its own primary links',()=>{
 const page=`<main><h1>Pesquisa sintética</h1><div id="article-body"><p>${content}</p><a href="https://www.caltech.edu/about/news/example">Original announcement</a></div><article><p>${'Unrelated suggested story. '.repeat(60)}</p></article></main>`;
 const doc=extractArticle(page,'https://www.space.com/test/');assert.ok(!doc.text.includes('Unrelated suggested story'));assert.deepEqual(doc.related_urls,['https://www.caltech.edu/about/news/example']);
});

test('an institutional about/news article is allowed but its news index is not an event source',()=>{
 assert.deepEqual(researchPrimaryLinks({related_urls:['https://www.caltech.edu/about/news','https://www.caltech.edu/about/news/actual-announcement']}),['https://www.caltech.edu/about/news/actual-announcement']);
});
test('access metadata ignores unrelated gated recommendations but never reveals a hidden body',()=>{
 const own={"@type":"NewsArticle",url:'https://www.space.com/test/',isAccessibleForFree:true};
 const unrelated={...own,url:'https://www.space.com/other/',isAccessibleForFree:false};
 assert.ok(extractArticle(`<script type="application/ld+json">${JSON.stringify([own,unrelated])}</script>`+html,own.url).text);
 const abstract=`<section id="Abs1"><h2>Abstract</h2><p>${content}</p></section>`;
 const paper=`<script type="application/ld+json">${JSON.stringify({...own,isAccessibleForFree:false})}</script><h1>Synthetic paper</h1><main>${abstract}<section hidden><p>RESTRICTED FULL TEXT ${content}</p></section></main>`;
 const d=extractArticle(paper,own.url);assert.equal(d.evidence_scope,'public_abstract');assert.ok(!d.text.includes('RESTRICTED FULL TEXT'));
 assert.throws(()=>extractArticle(paper.replace('<section id="Abs1">','<section id="Abs1" hidden>'),own.url),/research_access_restricted/);
});
test('first-hand reporting requires an explicit attribution to the registered publication',()=>{
 const url='https://www.theverge.com/test/';
 assert.equal(primaryDocument({url,text:'A spokesperson told The Verge that the launch is a test.'}),true);
 assert.equal(primaryDocument({url,text:'A spokesperson told another website about the test.'}),false);
 assert.equal(primaryDocument({url,text:'This site reports that a launch is planned.'}),false);
});
test('headline focus keeps a space telescope out of the hardware slot and filters shopping roundups',()=>{
 assert.deepEqual(researchTopic({title:'NASA UVEX space telescope announced',evidence:[{text:'Detectors use a new semiconductor chip.'}],editoria:'tecnologia'}),{category:'ciencia',subcategory:'aeroespacial'});
 assert.equal(researchTopic({title:'Melhor TV para comprar',evidence:[{text:'A robot and AI chip.'}]}),null);
 assert.equal(researchTopic({title:'Resultado da Lotofácil de hoje',evidence:[]}),null);
 assert.equal(researchTopic({title:'The best early Black Friday deals',evidence:[]}),null);
 assert.deepEqual(researchTopic({title:'Try Tabletop: Customizable collaborative spaces',evidence:[{text:'Google AI creates apps.'}],editoria:'tecnologia'}),{category:'tecnologia',subcategory:'software-ferramentas'});
});
