import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {referenceCatalog,referenceUrl} from '../src/corroboration.mjs';
import {referenceForUrl,primaryDocument,independentReference} from '../src/article-research.mjs';
import {researchTopic} from '../src/automatic-research.mjs';
import {validateSources} from '../src/worker.mjs';

const additions=['REF45','REF46','REF47'];
test('approved specialist sources are distinct publications; shipped feeds still require operational approval',async()=>{
  const sources=validateSources(JSON.parse(await readFile(new URL('../config/sources.json',import.meta.url),'utf8')));
  const publishers=new Set();
  for(const id of additions){
    const r=referenceCatalog.find(r=>r.id===id),s=sources.find(s=>s.id===id);
    assert.ok(r&&s);publishers.add(r.publisher);assert.equal(independentReference(r),true);
    assert.equal(s.enabled,false);assert.equal(s.feed_content_approved,false);assert.equal(s.collection_approval_reference,null);assert.equal(s.rights_reference,null);
    assert.equal(referenceForUrl(s.url).id,id);assert.equal(referenceUrl(s.url,r),s.url);
    assert.throws(()=>referenceUrl('https://unlisted.'+new URL(r.url).hostname.replace(/^www\./,'')+'/article/',r),/invalid_reference_url/);
    assert.throws(()=>validateSources([{...s,enabled:true}]),/collection_unapproved/);
    assert.throws(()=>validateSources([{...s,feed_content_approved:true}]),/rights_unapproved/);
  }
  assert.equal(publishers.size,3);assert.equal(referenceCatalog.filter(r=>r.id.startsWith('REF')).length,47);
});
test('specialist context supplies the topic without overriding headline focus or accepting shopping roundups',()=>{
  const c=(id,title)=>({source_id:id,editoria:'startups',title,evidence:[]});
  for(const id of ['REF45','REF46','ARTICLE_REF45','ARTICLE_REF46'])assert.deepEqual(researchTopic(c(id,'Brasil fecha primeiro dia do festival com 39 troféus')),{category:'negocios',subcategory:'marketing'});
  assert.deepEqual(researchTopic(c('REF47','Aliança de bancos investe para criar stablecoin em dólar')),{category:'negocios',subcategory:'empreendedorismo-startups'});
  assert.deepEqual(researchTopic(c('REF45','NASA anuncia telescópio espacial')),{category:'ciencia',subcategory:'aeroespacial'});
  assert.equal(researchTopic(c('REF47','Melhor TV para comprar')),null);
});
test('first-hand reporting needs explicit attribution; a source registration is not primary evidence',()=>{
  const url='https://startups.com.br/negocios/fixture/';
  assert.equal(primaryDocument({url,text:'A fundadora disse ao Startups que a rodada foi concluída.'}),true);
  for(const text of ['O Startups publicou uma notícia.','A fundadora disse ao StartupsFake que a rodada foi concluída.','A fundadora disse ao Propmark que a rodada foi concluída.'])assert.equal(primaryDocument({url,text}),false);
  assert.equal(primaryDocument({url:'https://www.meioemensagem.com.br/marketing/fixture',text:'A companhia confirmou ao Meio & Mensagem o início da campanha.'}),true);
});
