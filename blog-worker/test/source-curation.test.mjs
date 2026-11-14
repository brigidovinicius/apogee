import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceDiscovery} from '../src/source-discovery.mjs';
import {researchPriority,enrichResearch} from '../src/research-service.mjs';
import {researchTopic,automaticDossier} from '../src/automatic-research.mjs';
import {extractArticle,ARTICLE_EXTRACTION_VERSION} from '../src/article-research.mjs';
import {coverBrief,imageRequest,validateRasterQuality} from '../src/images.mjs';
import {defaultPolicy,imagePolicy} from './fixtures.mjs';
const prose='Documento inteiramente sintético de teste, com resultados preliminares e limitações explícitas. '.repeat(5);

test('broad news feeds cannot fill technology slots with unrelated headlines or commerce',()=>{
  const c=title=>({title,editoria:'tecnologia',source_id:'REF38',evidence:[]});
  for(const title of ['Synthetic football match and final score','Synthetic president meets parliament','Melhor celular para comprar em promoção'])assert.equal(researchTopic(c(title)),null);
  assert.deepEqual(researchTopic(c('Pesquisa computacional experimental sintética')),{category:'tecnologia',subcategory:null});
  assert.deepEqual(researchTopic(c('Synthetic cloud computing data platform announced')),{category:'tecnologia',subcategory:null});
  assert.deepEqual(researchTopic(c('Novo modelo de inteligência artificial em teste')),{category:'tecnologia',subcategory:'ia'});
});
test('curation rewards distinct registered sources and excludes rumors without validating facts',()=>{
  const c={url:'https://www.theverge.com/synthetic-ai',title:'Synthetic AI system announced',published_at:new Date().toISOString(),evidence:[{url:'https://www.theverge.com/synthetic-ai',text:prose,related_urls:[]}]};
  const references=['https://openai.com/index/synthetic-model/','https://blog.google/technology/ai/synthetic-model/'];
  const enriched={...c,evidence:[{...c.evidence[0],related_urls:references}]};
  assert.ok(researchPriority(enriched)>researchPriority(c));
  assert.equal(researchPriority({...enriched,title:'Rumor: synthetic AI system'}),-1);
  assert.equal(researchPriority({...enriched,title:'Conteúdo patrocinado: synthetic AI'}),-1);
  assert.equal(researchPriority({...c,evidence:[{...c.evidence[0],related_urls:['https://openai.com/index/synthetic-model/','https://openai.com/index/another-model/']}]}),researchPriority({...c,evidence:[{...c.evidence[0],related_urls:[references[0]]}]}));
});
test('discovery separates registered publishers, unknown leads and official media without fetching or licensing',()=>{
  const image={url:'https://www.nasa.gov/image/test.jpg',source_url:'https://www.nasa.gov/news-release/test/',rights_status:'review_required'};
  const d=sourceDiscovery({url:image.source_url,related_urls:['https://www.space.com/synthetic-one/','https://www.space.com/synthetic-two/','https://unknown-research.org/articles/research/','https://openai.com.evil.net/articles/test/','https://127.0.0.1/private/','https://internal.local/news/','https://user:pass@openai.com/index/test/','https://unknown-research.org/login/'],image_candidates:[image]});
  assert.equal(d.registered.length,1);assert.equal(d.registered[0].publisher,'space-com');
  assert.deepEqual(d.unregistered.map(v=>v.host),['unknown-research.org','openai.com.evil.net']);
  assert.equal(d.images.length,1);assert.equal(d.rights_status,'review_required');
  assert.equal(sourceDiscovery({url:'https://www.space.com/test/',image_candidates:[image]}).images.length,0);
});
test('image metadata stays attached to its exact declared image; protected bodies and unsafe assets are excluded',()=>{
  const url='https://www.nasa.gov/news-release/synthetic-images/',image='https://www.nasa.gov/images/synthetic.jpg';
  const meta={'@type':'NewsArticle',url,image:{'@type':'ImageObject',contentUrl:image,creditText:'Synthetic photographer',license:'https://www.nasa.gov/license/synthetic/'}};
  const html=`<script type="application/ld+json">${JSON.stringify(meta)}</script><meta property="og:image" content="${image}"><main><h1>Synthetic photo report</h1><p>${prose}</p><img src="${image}" alt="Synthetic source description"><img src="https://www.nasa.gov/images/other.jpg" alt="Other photo"><img src="https://127.0.0.1/private.jpg"></main>`;
  const d=extractArticle(html,url);
  assert.equal(d.image_candidates.length,2);assert.equal(d.image_candidates[0].credit,'Synthetic photographer');assert.equal(d.image_candidates[0].alt,'Synthetic source description');
  assert.equal(d.image_candidates[1].credit,null);assert.equal(d.image_candidates[1].license_url,null);
  assert.ok(d.image_candidates.every(v=>v.rights_status==='review_required'));
  const protectedHtml=html.replace(JSON.stringify(meta),JSON.stringify({...meta,isAccessibleForFree:false})).replace('<main>','<main><div id="abstract">'+prose+'</div>');
  assert.deepEqual(extractArticle(protectedHtml,url).image_candidates,[]);
});
test('primary research follows registered independent links within the existing HTTP budget and remains unverified',async()=>{
  const url='https://blog.google/technology/ai/synthetic-test/',news='https://www.theverge.com/synthetic-test/',now=new Date().toISOString();
  const candidate={id:'synthetic-primary',url,title:'Synthetic AI model announced',source_id:'ARTICLE_PRIMARY_GOOGLE_BLOG',published_at:now,evidence:[]};
  const docs=[],progress=[],calls=[],captures=[];
  const result=await enrichResearch({candidate,topic:{category:'tecnologia',subcategory:'ia'},captures,store:{researchCandidate:async()=>candidate,captureResearchDocument:async(c,d)=>docs.push(d),researchProgress:async(id,p)=>progress.push(p)},read:async(u,b)=>{b.used+=2;calls.push(u);return {url:u,title:'Synthetic AI model announced',text:(u===url?'Fonte primária sintética. ':'Análise independente sintética. ')+prose,published_at:now,source_id:u===url?'ARTICLE_PRIMARY_GOOGLE_BLOG':'ARTICLE_REF38',extraction_method:'public_article',extraction_version:ARTICLE_EXTRACTION_VERSION,rights_reference:'Synthetic public excerpt',related_urls:u===url?[news,'https://unknown-research.org/articles/test/']:[url]};}});
  assert.deepEqual(calls,[url,news]);assert.equal(result.requests,4);assert.equal(docs.length,2);
  assert.equal(progress[0].source_discovery.unregistered.length,1);
  const dossier=automaticDossier(candidate,captures,defaultPolicy,{category:'tecnologia',subcategory:'ia'});assert.ok(dossier);assert.deepEqual(dossier.claims,[]);
});
test('photo briefs use subject-specific context within the unchanged byte cap; pixel checks reject blank and tiny assets',()=>{
  const ai=coverBrief({title:'Modelo de inteligência artificial',excerpt:'Comparação entre regressão e classificação.'});
  const business=coverBrief({title:'Pesquisa de mercado para empresas',excerpt:'Contexto e métodos.'});
  assert.match(ai.prompt,/sem robô humanoide/);assert.match(business.prompt,/calculadora/);
  for(const brief of [ai,business,coverBrief({title:'á'.repeat(140),excerpt:'á'.repeat(400)})])assert.equal(imageRequest(brief,imagePolicy).n,1);
  assert.throws(()=>validateRasterQuality({width:64,height:64},{channels:[{stdev:15},{stdev:15},{stdev:15}]}),/image_resolution/);
  assert.throws(()=>validateRasterQuality({width:800,height:600},{channels:[{stdev:0},{stdev:0},{stdev:0}]}),/image_uniform/);
  assert.doesNotThrow(()=>validateRasterQuality({width:800,height:600},{channels:[{stdev:20},{stdev:30},{stdev:10}]}));
});
