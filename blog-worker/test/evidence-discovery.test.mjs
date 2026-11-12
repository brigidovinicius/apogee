import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalResearchUrl} from '../src/research-links.mjs';
import {extractArticle,primaryDocument,ARTICLE_EXTRACTION_VERSION} from '../src/article-research.mjs';
import {sameResearchEvent,researchTopic} from '../src/automatic-research.mjs';
import {normalizeItem} from '../src/editorial.mjs';
import {buildComparisonRequest} from '../src/corroboration.mjs';
import {researchPrimaryLinks,researchPriority,enrichResearch} from '../src/research-service.mjs';
import {source,defaultPolicy} from './fixtures.mjs';
import {dossierFixture} from './corroboration-fixture.mjs';
const text='A equipe anunciou um experimento inicial. O estudo é uma simulação inteiramente sintética para testes de descoberta e não descreve resultados reais. Limitações metodológicas ainda precisam ser avaliadas antes de qualquer aplicação.';
test('legacy HTTP DOI citations are upgraded only on exact public resolver hosts and preserved in RSS and HTML',()=>{
 const doi='http://dx.doi.org/10.1234/synthetic-test';
 assert.equal(canonicalResearchUrl(doi),'https://dx.doi.org/10.1234/synthetic-test');
 for(const url of ['http://evil.test/10.1234/a','http://doi.org.evil.test/10.1234/a','http://user@doi.org/10.1234/a','http://doi.org:8080/10.1234/a'])assert.throws(()=>canonicalResearchUrl(url));
 const item=normalizeItem({title:'Synthetic research',link:'https://example.org/research/legacy-doi',isoDate:new Date().toISOString(),contentSnippet:text,content:`<p>${text}</p><a href="${doi}">DOI</a>`},source,new Date());
 assert.deepEqual(item.evidence[0].related_urls,['https://dx.doi.org/10.1234/synthetic-test']);
 const unchanged=normalizeItem({title:'Synthetic research',link:'https://example.org/research/legacy-https',isoDate:new Date().toISOString(),contentSnippet:text,content:'<a href="https://www.nasa.gov/news/?utm_source=fixture#section">Source</a>'},source,new Date());
 assert.deepEqual(unchanged.evidence[0].related_urls,['https://www.nasa.gov/news/?utm_source=fixture']);
 const doc=extractArticle(`<main><div id="story_text">${text}</div><div id="journal_references"><a href="${doi}">DOI</a></div><aside>${'Related headline '.repeat(30)}</aside></main>`,'https://www.sciencedaily.com/releases/2026/11/test.htm',{fallbackTitle:'Synthetic paper'});
 assert.equal(doc.text,text);assert.deepEqual(doc.related_urls,['https://dx.doi.org/10.1234/synthetic-test']);
});
test('Elementor main article content is selected instead of short unrelated post excerpts',()=>{
 const html=`<div class="entry-content">A short unrelated recommended story.</div><div class="elementor-widget-theme-post-content"><p>${text}</p></div><main>${'Unrelated navigation '.repeat(40)}</main>`;
 const d=extractArticle(html,'https://propmark.com.br/midia/synthetic/',{fallbackTitle:'Synthetic article'});assert.equal(d.text,text);
 assert.throws(()=>extractArticle('<meta name="robots" content="nosnippet">'+html,d.url),/research_excerpt_disallowed/);
 assert.throws(()=>extractArticle('<script>{"isAccessibleForFree":false}</script>'+html,d.url),/research_access_restricted/);
});
test('explicit outlet interviews and first-person reporting are recognized without making mere mentions primary',()=>{
 const url='https://www.meioemensagem.com.br/marketing/synthetic';
 for(const phrase of ['Meio & Mensagem conversou com especialistas.','Segundo apuração do Meio & Mensagem, o resultado ainda é preliminar.','A executiva afirma ao Meio & Mensagem que o projeto começou.'])assert.equal(primaryDocument({url,text:phrase}),true);
 for(const phrase of ['O Meio & Mensagem publicou um artigo.','Propmark conversou com especialistas.','Meio & MensagemFake conversou com especialistas.'])assert.equal(primaryDocument({url,text:phrase}),false);
});
test('an exact common primary document selects a pair; generic links, publishers and date mismatches do not',()=>{
 const primary='https://www.nasa.gov/news-release/synthetic-experiment-announced/',date=new Date().toISOString();
 const a={url:'https://www.space.com/synthetic-a/',text,title:'Synthetic original reporting',source_id:'REF27',published_at:date,related_urls:[primary]};
 const b={...a,url:'https://arstechnica.com/synthetic-b/',source_id:'REF39'};
 assert.equal(sameResearchEvent(a,b),true);
 for(const link of ['https://www.nasa.gov/','https://blog.google/products/chrome/','https://unregistered.invalid/research/event/'])assert.equal(sameResearchEvent({...a,related_urls:[link]},{...b,related_urls:[link]}),false);
 assert.equal(sameResearchEvent(a,{...b,published_at:'2020-01-01T00:00:00Z'}),false);
});
test('comparison requests enumerate the exact documents, bound cells and preserve factual rules on format repair',()=>{
 const d=dossierFixture(3),normal=buildComparisonRequest(d,defaultPolicy),repair=buildComparisonRequest(d,defaultPolicy,true);
 const cells=normal.text.format.schema.properties.claims.items.properties.cells;
 assert.deepEqual(cells.items.properties.document_id.enum,['E1','E2']);assert.equal(cells.minItems,2);assert.equal(cells.maxItems,2);
 assert.equal(cells.items.properties.note.maxLength,240);assert.equal(normal.text.format.schema.properties.claims.maxItems,6);
 assert.match(repair.instructions,/Única reparação de formato/);assert.match(repair.instructions,/90%/);assert.equal(normal.input,repair.input);
});

test('literal DOI citations without hyperlinks are discovered and prioritize bounded primary research',()=>{
 const doc={url:'https://www.space.com/synthetic/',text:'Synthetic journal reference DOI 10.1234/unlinked-reference.',related_urls:[]};
 assert.deepEqual(researchPrimaryLinks(doc),['https://doi.org/10.1234/unlinked-reference']);
 assert.ok(researchPriority({evidence:[doc]})>researchPriority({evidence:[{...doc,text:'A generic mention without a primary reference.'}]}));
});

test('operational topic history cannot override a clear headline; editorial assignments and same-category generals remain',()=>{
 const c={title:'NASA mission crew returns from simulated Mars',editoria:'tecnologia',evidence:[],artifact:{research:{stage:'research_primary_missing',topic:{category:'tecnologia',subcategory:'hardware-robotica'}}}};
 assert.deepEqual(researchTopic(c),{category:'ciencia',subcategory:'aeroespacial'});
 assert.deepEqual(researchTopic({...c,artifact:{research:{topic:{category:'tecnologia',subcategory:'ia'}}}}),{category:'tecnologia',subcategory:'ia'});
 assert.deepEqual(researchTopic({...c,artifact:{research:{stage:'primary_found',topic:{category:'ciencia',subcategory:null}}}}),{category:'ciencia',subcategory:null});
});
test('publication dates come from this article, never a recommended article or an outside time element',()=>{
 const url='https://www.nasa.gov/news-release/synthetic-date/';
 const unrelated={'@type':'NewsArticle',url:'https://www.nasa.gov/unrelated/',datePublished:'2030-01-01T00:00:00Z'},own={'@type':'NewsArticle',url,datePublished:'2026-11-06T12:00:00Z'};
 const body=`<header><time datetime="2031-01-01T00:00:00Z">Other time</time></header><main>${text}</main>`;
 assert.equal(extractArticle(`<script type="application/ld+json">${JSON.stringify([unrelated,own])}</script>${body}`,url,{fallbackTitle:'Synthetic report'}).published_at,own.datePublished.replace('Z','.000Z'));
 assert.equal(extractArticle(`<script type="application/ld+json">${JSON.stringify(unrelated)}</script>${body}`,url,{fallbackTitle:'Synthetic report'}).published_at,null);
});
test('a legacy extraction is refreshed once and its original snapshot remains intact',async()=>{
 const url='https://www.space.com/synthetic-refresh/',now=new Date().toISOString();
 const old={url,title:'Old synthetic snapshot',text,source_id:'ARTICLE_REF27',extraction_method:'public_article',extraction_version:'legacy',related_urls:[]};const captures=[old];let reads=0,saved=0;
 const result=await enrichResearch({store:{captureResearchDocument:async()=>{saved++;},researchCandidate:async()=>({id:'synthetic-seed',url})},candidate:{id:'synthetic-seed',url,published_at:now},topic:{category:'ciencia',subcategory:'aeroespacial'},captures,read:async()=>{reads++;return {...old,title:'Current synthetic report',text:'The researcher told Space.com that this is a synthetic test. '+text,published_at:now,extraction_version:ARTICLE_EXTRACTION_VERSION};}});
 assert.equal(reads,1);assert.equal(saved,1);assert.ok(result.primary);assert.equal(captures.length,2);assert.equal(old.extraction_version,'legacy');assert.equal(old.text,text);
});
test('a primary headline corrects a stale cross-category seed before comparison preparation',async()=>{
 const url='https://tecnoblog.net/noticias/synthetic-seed/',primary='https://www.nasa.gov/news-release/synthetic-primary/',now=new Date().toISOString(),saved=new Map();
 const result=await enrichResearch({store:{captureResearchDocument:async()=>{},ingest:async c=>saved.set(c.url,c),researchCandidate:async u=>saved.get(u),researchProgress:async()=>{}},candidate:{id:'synthetic-seed',url,title:'Synthetic report',published_at:now},topic:{category:'tecnologia',subcategory:'hardware-robotica'},captures:[],read:async u=>({url:u,title:u===primary?'NASA mission crew returns from simulated Mars':'Synthetic report',text,source_id:u===primary?'ARTICLE_REF22':'ARTICLE_REF05',published_at:now,rights_reference:'Public synthetic test excerpt',related_urls:u===url?[primary]:[],extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION})});
 assert.deepEqual(result.topic,{category:'ciencia',subcategory:'aeroespacial'});assert.deepEqual(researchTopic(result.primary),result.topic);
});
