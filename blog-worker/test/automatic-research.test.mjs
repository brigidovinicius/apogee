import test from 'node:test';
import assert from 'node:assert/strict';
import {automaticDossier,sameResearchEvent,sameProductLaunch} from '../src/automatic-research.mjs';
import {normalizeItem} from '../src/editorial.mjs';
import {assessDossier} from '../src/corroboration.mjs';
import {tick} from '../src/worker.mjs';
import {defaultPolicy,source} from './fixtures.mjs';

const date=new Date().toISOString();
const text='A equipe anunciou um experimento inicial. Este documento é uma evidência inteiramente sintética de teste, sem resultados reais. O estudo possui o identificador DOI 10.1234/synthetic-example e exige avaliações adicionais antes de qualquer aplicação prática.';
function fixtures(){
 const primary=normalizeItem({title:'Synthetic NASA research',link:'https://www.nasa.gov/synthetic-research/',isoDate:date,contentSnippet:text},{...source,id:'SRC01',editoria:'ciencia-espaco',article_hosts:['www.nasa.gov']},new Date());
 const a={...primary.evidence[0],capture_id:'a'.repeat(64)};
 const b={...a,capture_id:'b'.repeat(64),source_id:'REF27',url:'https://www.space.com/synthetic-analysis/',title:'Synthetic independent reporting',text:'Análise jornalística sintética com contexto e limitações próprios. '+text};
 return {primary,a,b};
}
test('automatic grouping needs an exact shared DOI or explicit article link, never similar titles',()=>{
 const {a,b}=fixtures();assert.equal(sameResearchEvent(a,b),true);
 assert.equal(sameResearchEvent({...a,text:'No identifier here'}, {...b,text:'Similar topic without a shared identifier'}),false);
 assert.equal(sameResearchEvent({...a,text:'No identifier here'}, {...b,text:'No DOI',related_urls:[a.url]}),true);
 assert.equal(sameResearchEvent(a,{...b,published_at:'2020-01-01T00:00:00Z'}),false);
});
test('automatic dossiers keep snapshots, start unverified and reject identical republications',()=>{
 const {primary,a,b}=fixtures(),original=structuredClone([a,b]);
 const d=automaticDossier(primary,[a,b],defaultPolicy);
 assert.ok(d);assert.equal(d.claims.length,0);assert.equal(assessDossier(d).eligible,false);
 assert.equal(d.documents[0].capture_id,a.capture_id);assert.deepEqual([a,b],original);
 assert.equal(automaticDossier(primary,[a,{...b,text:a.text}],defaultPolicy),null);
 assert.equal(automaticDossier(primary,[a,{...b,source_id:'SRC02'}],defaultPolicy),null);
});
test('an exact dated corporate product launch can select a public RSS preview without an outbound link',()=>{
 const {a:base}=fixtures();
 const a={...base,source_id:'ARTICLE_PRIMARY_GOOGLE_BLOG',url:'https://blog.google/synthetic-tabletop',title:'Try Tabletop: A synthetic launch fixture',published_at:date,text:'Google announces the experimental Tabletop tool. '.repeat(8)};
 const b={...base,source_id:'REF38',url:'https://www.theverge.com/synthetic-tabletop',title:'Google’s Tabletop experiment adds collaboration tools',published_at:date,text:'Google has launched an experimental tool called Tabletop. This is a synthetic public RSS preview for tests. '.repeat(3)};
 assert.equal(sameProductLaunch(a,b),true);assert.equal(sameResearchEvent(a,b),true);assert.equal(sameResearchEvent(b,a),true);
 const c=normalizeItem({title:a.title,link:a.url,isoDate:date,contentSnippet:a.text},{...source,id:'PRIMARY_GOOGLE_BLOG',editoria:'tecnologia',article_hosts:['blog.google']},new Date());
 const d=automaticDossier(c,[{...a,capture_id:'a'.repeat(64)},{...b,capture_id:'b'.repeat(64)}],defaultPolicy,{category:'tecnologia',subcategory:'software-ferramentas'});
 assert.ok(d);assert.equal(assessDossier(d).eligible,false);assert.equal(d.claims.length,0);
 for(const wrong of [
  {...b,title:'Microsoft Tabletop experiment',text:'Microsoft has launched Tabletop.'},
  {...b,title:'Google’s Tabletop Pro experimental tool'},
  {...b,title:'Google’s Tabletop review'},
  {...b,title:'Google’s Tabletop rumor'},
  {...b,published_at:new Date(Date.parse(date)-3*86400000).toISOString()},
  {...b,published_at:null},
  {...b,published_at:'invalid'},
  {...b,source_id:'PRIMARY_MICROSOFT_BLOG'}
 ])assert.equal(sameProductLaunch(a,wrong),false);
});
test('versioned product identity cannot be replaced by generic brand or a different model',()=>{
 const a={source_id:'PRIMARY_GOOGLE_BLOG',title:'Gemini 4 Carbon is now available',published_at:date,text:'Google has announced Gemini 4 Carbon.'};
 const b={source_id:'REF05',title:'Google lança Gemini 4 Carbon',published_at:date,text:'Google lançou Gemini 4 Carbon para desenvolvedores.'};
 assert.equal(sameProductLaunch(a,b),true);
 assert.equal(sameProductLaunch(a,{...b,title:'Google lança Gemini 3 Carbon'}),false);
 assert.equal(sameProductLaunch({...a,title:'Google is now available',text:'Google launched new products.'},{...b,title:'Google lança produtos'}),false);
});
test('opening excerpts remain literal with decimals, abbreviations and adjacent punctuation',()=>{
 const {primary,a,b}=fixtures();
 const sentence='Dr. Silva mediu 3.14 unidades no teste?! O DOI 10.1234/synthetic-example identifica o estudo. ';
 a.text=sentence.repeat(30);b.text='Análise independente do experimento. '+sentence.repeat(30);
 const d=automaticDossier(primary,[a,b],defaultPolicy);assert.ok(d);
 for(const doc of d.documents){
  const original=doc.id==='E1'?a.text:b.text;
  assert.equal(original.slice(0,doc.text.length),doc.text);
  assert.ok(Buffer.byteLength(doc.text)<=3000);
 }
 assert.equal(a.text,sentence.repeat(30));
});
test('automatic idle queue never invokes the Google client or its quota endpoint',async()=>{
 const provider=()=>assert.fail('no model call');provider.preflight=()=>assert.fail('no quota request without work');
 const store={recover:async()=>0,maintenance:async()=>({capture_allowed:true}),prepareAutomaticResearch:async()=>({prepared:0}),nextAutomaticWork:async()=>null};
 const result=await tick({store,config:{policy:{...defaultPolicy,generation_enabled:true,google_account_email:'fixture@example.test',operator_commands_only:false},sources:[]},provider});
 assert.equal(result.generation.reason,'waiting_for_evidence');
});
