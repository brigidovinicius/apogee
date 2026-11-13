import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRequest,cmsDraft,SEO_GUIDELINES} from '../src/editorial.mjs';
import {candidate,article,policy} from './fixtures.mjs';

test('Google editorial guidelines apply to each provider in the existing writing call',()=>{
  for(const provider of ['google_subscription','openai_api']){
    const body=buildRequest(candidate(),{...policy,provider,input_counting_mode:'local_byte_bound'});
    assert.ok(body.instructions.includes(SEO_GUIDELINES.instructions));
    assert.equal(body.tools.length,0);assert.equal(body.store,false);
    assert.ok(Buffer.byteLength(JSON.stringify(body))+1024<=policy.input_tokens_cap_including_overhead);
  }
});
test('new drafts have descriptive stable URLs and retain independently credited references',()=>{
  const c=candidate(),a={...article,title:'Ciência e IA: próximos passos para a pesquisa'};
  const draft=cmsDraft(c,a);
  assert.match(draft.slug,/^ciencia-e-ia-proximos-passos-para-a-pesquisa-[a-f0-9]{24}$/);
  assert.equal(cmsDraft(c,a).slug,draft.slug);
  assert.notEqual(cmsDraft({...c,id:'b'.repeat(64)},a).slug,draft.slug);
  const long=cmsDraft(c,{...a,title:'Título informativo longo '.repeat(8)}).slug;assert.ok(long.length<=90);assert.ok(long.endsWith(c.id.slice(0,24)));
  assert.match(draft.body,/Fontes:/);
  assert.equal(draft.body.includes(c.evidence[0].url),true);
});
