import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';

test('pipeline page and every action require administrator before database access',async()=>{
  let writes=0;
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>{throw Error('forbidden');}},
    '@/lib/blog/pipeline':new Proxy({}, {get:()=>()=>{writes++;throw Error('database must not run');}}),
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:()=>{}}});
  const action=load('app/admin/posts/pipeline/actions.ts').managePipeline;
  for(const intent of ['collect','generate','source','pause','resume','hold','release','cover','apply_cover']){
    const f=new FormData();f.set('intent',intent);await assert.rejects(()=>action(f),/forbidden/);
  }
  await assert.rejects(()=>load('app/admin/posts/pipeline/page.tsx').default({searchParams:Promise.resolve({})}),/forbidden/);
  assert.equal(writes,0);
});
test('action ignores forged actor and budgets, validates candidate and only enqueues creation',async()=>{
  const calls=[];
  const load=opportunityLoader({'@/lib/admin/access':{requireAdmin:async()=>({id:'real-admin'})},
    '@/lib/blog/pipeline':{enqueuePipeline:async(...args)=>{calls.push(args);return true;}},
    'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:path=>{throw Error(path);}}});
  const action=load('app/admin/posts/pipeline/actions.ts').managePipeline;
  const f=new FormData();f.set('intent','generate');f.set('candidate_id','a'.repeat(64));f.set('actor','forged');f.set('budget','99999');
  await assert.rejects(()=>action(f),/message=queued/);assert.deepEqual(calls,[['real-admin','generate','a'.repeat(64)]]);
  f.set('candidate_id','invalid');await assert.rejects(()=>action(f),/message=invalid/);assert.equal(calls.length,1);
});
test('source approval, HTTPS allowlist, editorial category and prompt byte limit are validated',()=>{
  const {sourceSchema,coverSchema}=opportunityLoader()('lib/blog/pipeline-validation.ts');
  const s={id:'NASA',name:'NASA',editoria:'tecnologia',url:'https://www.nasa.gov/feed/',article_hosts:['www.nasa.gov'],interval_minutes:60,keywords:[],enabled:true,feed_content_approved:true,collection_approval_reference:'editorial-approval',rights_reference:'editorial-license'};
  assert.equal(sourceSchema.safeParse(s).success,true);
  for(const bad of [{url:'http://www.nasa.gov/feed'},{url:'https://evil.test/feed'},{url:'https://name:pass@www.nasa.gov/feed'},{interval_minutes:1},{collection_approval_reference:''},{rights_reference:''}])assert.equal(sourceSchema.safeParse({...s,...bad}).success,false);
  assert.equal(coverSchema.safeParse({candidate_id:'a'.repeat(64),prompt:'é'.repeat(800),alt:'Imagem',caption:'Ilustração gerada por IA.'}).success,false);
});
test('private pending cover returns 401/403 without querying database, admin gets no-store image',async()=>{
  let calls=0,member=null;
  const load=opportunityLoader({'@/lib/members/dal':{getCurrentMember:async()=>member},'@/lib/members/db':{getSql:()=>async()=>{calls++;return [{image:Buffer.from('fixture')}];}}});
  const get=load('app/admin/posts/pipeline/cover/[id]/route.ts').GET;
  const ctx={params:Promise.resolve({id:'a'.repeat(64)})};
  assert.equal((await get(new Request('https://example.test'),ctx)).status,401);
  member={role:'member'};assert.equal((await get(new Request('https://example.test'),ctx)).status,403);assert.equal(calls,0);
  member={role:'admin'};const response=await get(new Request('https://example.test'),ctx);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
});
test('SEO/GEO review accepts generated references and rejects unsafe or absent citations',()=>{
  const {sourceReferences,editorialChecks}=opportunityLoader()('lib/blog/editorial-review.ts');
  const body='Texto com referência. [1]\n\nFontes:\n[1] NASA test — https://www.nasa.gov/article/ (2026-11-04)';
  assert.deepEqual(sourceReferences(body),[{title:'NASA test',url:'https://www.nasa.gov/article/'}]);
  assert.deepEqual(sourceReferences(body.replaceAll('\n','\r\n')),sourceReferences(body),'Saving the HTML editor preserves citation recognition');
  assert.deepEqual(sourceReferences(body.replaceAll('\n','\r')),sourceReferences(body));
  for(const url of ['http://nasa.gov/article','javascript:alert(1)','https://user:secret@nasa.gov/article'])assert.equal(sourceReferences(body.replace('https://www.nasa.gov/article/',url)).length,0);
  assert.equal(sourceReferences('Texto sem fontes').length,0);
  const checks=editorialChecks({title:'Título informativo',body,seoTitle:'Título de busca',seoDescription:'Descrição de busca',hasCover:true,noIndex:true});
  assert.equal(checks.every(c=>c.ok),true);assert.match(checks.at(-1).label,/bloqueada/);
});
