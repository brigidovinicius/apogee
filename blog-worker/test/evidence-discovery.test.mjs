import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalResearchUrl} from '../src/research-links.mjs';
import {extractArticle,primaryDocument} from '../src/article-research.mjs';
import {sameResearchEvent,automaticDossier} from '../src/automatic-research.mjs';
import {normalizeItem} from '../src/editorial.mjs';
import {buildComparisonRequest} from '../src/corroboration.mjs';
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
