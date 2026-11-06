import assert from 'node:assert/strict';
import test from 'node:test';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
import {digestBatch} from '../scripts/collection-digest-worker.mjs';
test('digest endpoint rejects missing, wrong and unicode credentials before processing',async()=>{
 let calls=0;process.env.RADAR_COLLECTION_DIGEST_SECRET='s'.repeat(32);
 const {POST}=opportunityLoader({'@/lib/opportunities/collection-digest-worker':{runCollectionDigests:async()=>{calls++;return {enabled:false};}}})('app/api/colecoes/resumos/route.ts');
 for(const value of ['', 'Bearer '+'x'.repeat(32), 'Bearer '+'é'.repeat(32)])assert.equal((await POST(new Request('https://example.test',{method:'POST',headers:{authorization:value}}))).status,401);
 assert.equal(calls,0);assert.equal((await POST(new Request('https://example.test',{method:'POST',headers:{authorization:'Bearer '+'s'.repeat(32)}}))).status,200);assert.equal(calls,1);
});
test('timer submits secret only in header and returns allowlisted aggregate metrics',async()=>{
 const result=await digestBatch({origin:'https://example.test',secret:'s'.repeat(32),fetcher:async(url,options)=>{
  assert.equal(url.pathname,'/api/colecoes/resumos');assert.equal(url.search,'');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer '+'s'.repeat(32));
  return Response.json({enabled:true,checked:3,accepted:1,retry:1,cancelled:0,private:'never log this'});
 }});
 assert.equal(result.accepted,1);assert.equal('private' in result,false);
 await assert.rejects(digestBatch({origin:'https://user:password@example.test',secret:'s'.repeat(32)}));
});
test('digest action requires explicit consent, derives actor from session and allows cancellation without paid access',async()=>{
 const writes=[];let eligible=true;
 const {collectionDigestAction}=opportunityLoader({
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/members/dal':{requireSignedInMember:async()=>({id:'session-owner'})},
  '@/lib/opportunities/collections':{requireCollectionMember:async()=>{if(!eligible)throw Error('access required');return {id:'session-owner'};}},
  '@/lib/opportunities/collection-following':{setCollectionDigest:async(...args)=>writes.push(args)},
 })('app/membros/colecoes/follow-actions.ts');
 const form=new FormData();form.set('id','collection');form.set('userId','forged-owner');form.set('enabled','true');
 assert.match((await collectionDigestAction({},form)).error,/autorização/);assert.equal(writes.length,0);
 form.set('consent','weekly-v1');await collectionDigestAction({},form);assert.deepEqual(writes[0],['session-owner','collection',true]);
 eligible=false;await assert.rejects(collectionDigestAction({},form),/access required/);
 form.set('enabled','false');await collectionDigestAction({},form);assert.deepEqual(writes[1],['session-owner','collection',false]);
});
test('login and billing preserve only canonical collection destinations',()=>{
 const load=opportunityLoader(),navigation=load('lib/opportunities/calendar-navigation.ts'),billing=load('lib/opportunities/detail-path.ts');
 for(const path of ['/membros/colecoes/acompanhadas','/membros/colecoes/seguir/'+'a'.repeat(48)]){
  assert.equal(navigation.calendarReturnPath(path),path);assert.equal(billing.radarDetailReturnPath(path),path);
 }
 assert.equal(navigation.calendarReturnPath('https://evil.example/membros/colecoes'),'/membros/meu-calendario');
 assert.equal(navigation.calendarReturnPath('/membros/colecoes/seguir/'+'a'.repeat(48)+'?token=secret'),'/membros/colecoes/seguir/'+'a'.repeat(48));
});
