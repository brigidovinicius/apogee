import assert from 'node:assert/strict';
import {calendarTestDatabase} from './helpers/calendar-test-database.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const sql=await calendarTestDatabase();
Object.assign(process.env,{RADAR_COLLECTIONS_ENABLED:'true',RADAR_COLLECTION_SHARING_ENABLED:'true',RADAR_COLLECTION_FOLLOWING_ENABLED:'true',RADAR_COLLECTION_DIGEST_ENABLED:'true',RADAR_COLLECTION_DIGEST_WORKER_ENABLED:'true',RADAR_COLLECTION_DIGEST_DAILY_LIMIT:'10'});
const owner='calendar-follow-test-owner',reader='calendar-follow-test-reader',other='calendar-follow-test-other';
const users=[owner,reader,other],messages=[];let fail=false;
let catalogue=[{id:'radar-follow-test-one',title:'Evento original',organization:'Teste',kind:'Programa',level:'Público diverso',categories:['eventos'],location:'Brasil',summary:'Público',eligibility:'PRIVATE_ELIGIBILITY',officialUrl:'https://example.invalid/PRIVATE',deadline:'2099-01-01',verifiedAt:'2026-11-05'}];
const load=opportunityLoader({'@/lib/members/db':{getSql:()=>sql},'./personal-calendar':{personalCalendarEnabled:()=>true},'./radar-client':{listRadarOpportunities:async()=>catalogue},
 '@/lib/members/mail':{applicationOrigin:()=> 'https://apogee.example.test',memberMailAvailable:()=>true,sendMemberMail:async message=>{messages.push(message);if(fail)throw Error('synthetic timeout');}},
 '@/lib/members/protection':{adultAccess:async()=>true},'@/lib/billing/store':{radarAccess:async()=>({active:true})}});
const collections=load('lib/opportunities/collections.ts'),following=load('lib/opportunities/collection-following.ts'),worker=load('lib/opportunities/collection-digest-worker.ts');
// A historical clock keeps the worker from touching unrelated local preview users.
let now=new Date('2020-02-01T12:00:00Z');
async function due(){now=new Date(now.getTime()+8*86400000);await sql`update radar_calendar_digest_state set next_due_at=${now.toISOString()} where user_id=${reader}`;}
async function run(date=now){return worker.runCollectionDigests({now:date});}
try{
 for(const id of users)await sql`insert into "user"(id,name,email,email_verified) values(${id},'Teste de acompanhamento',${id+'@example.test'},true) on conflict do nothing`;
 const a=await collections.createCollection(owner,{name:'Primeira',description:'',cover:'aurora'}),b=await collections.createCollection(owner,{name:'Segunda',description:'',cover:'floresta'});
 await collections.setCollectionItem(owner,a,catalogue[0].id,true);await collections.setCollectionItem(owner,b,catalogue[0].id,true);
 const tokenA=await collections.shareCollection(owner,a,true),tokenB=await collections.shareCollection(owner,b,true);
 await assert.rejects(following.followCollection(reader,'bad'));
 await Promise.all([following.followCollection(reader,tokenA),following.followCollection(reader,tokenA)]);
 await following.followCollection(reader,tokenB);
 assert.equal((await following.followedCollections(reader)).length,2);assert.equal((await following.followedCollections(reader))[0].digestEnabled,false);
 assert.equal((await sql`select count(*)::int as n from radar_saved_opportunity where user_id=${reader}`)[0].n,0);
 await assert.rejects(following.setCollectionDigest(other,a,true));
 await due();await run();assert.equal(messages.length,0);
 await sql`update "user" set email_verified=false where id=${reader}`;await assert.rejects(following.setCollectionDigest(reader,a,true));
 await sql`update "user" set email_verified=true where id=${reader}`;
 await following.setCollectionDigest(reader,a,true);await following.setCollectionDigest(reader,b,true);
 await due();await run();assert.equal(messages.length,0,'opt-in starts from current content');
 catalogue[0].verifiedAt='2027-01-01';await due();await run();assert.equal(messages.length,0,'verification-only update is silent');
 catalogue[0].deadline='2099-02-02';await due();
 process.env.RADAR_COLLECTION_DIGEST_WORKER_ENABLED='false';assert.equal((await run()).enabled,false);assert.equal(messages.length,0);
 process.env.RADAR_COLLECTION_DIGEST_WORKER_ENABLED='true';
 await Promise.all([run(),run()]);assert.equal(messages.length,1,'concurrent workers produce one combined submission');
 assert.equal(messages[0].text.split('Evento original').length-1,1,'deduplicate across collections');assert.equal(messages[0].text.includes('PRIVATE'),false);
 assert.equal((await sql`select status,payload from radar_calendar_digest_job where user_id=${reader} order by created_at desc limit 1`)[0].payload,null,'remove delivered content from audit');
 catalogue[0].title='Evento atualizado';await due();fail=true;await run();const failedAttempt=messages.at(-1);
 const [before]=await sql`select baseline from radar_calendar_follow where user_id=${reader} and collection_id=${a}`;
 assert.notEqual(before.baseline[catalogue[0].id],load('lib/opportunities/collection-digest-content.ts').digestFingerprint(catalogue[0]),'failed send does not advance baseline');
 await run(new Date(now.getTime()+1000));assert.equal(messages.at(-1),failedAttempt,'backoff respected');
 fail=false;await run(new Date(now.getTime()+16*60000));assert.equal(messages.at(-1).key,failedAttempt.key);assert.equal(messages.at(-1).text,failedAttempt.text);
 catalogue[0].title='Mudança cancelada';await due();fail=true;await run();const afterFailure=messages.length;
 const [state]=await sql`select unsubscribe_token from radar_calendar_digest_state where user_id=${reader}`;
 await following.unsubscribeCollectionDigests(state.unsubscribe_token);fail=false;await run(new Date(now.getTime()+16*60000));assert.equal(messages.length,afterFailure,'unsubscribe cancels queued mail');
 assert.equal((await following.followedCollections(reader)).length,2,'unsubscribe preserves following');
 await following.setCollectionDigest(reader,a,true);catalogue[0].title='Não enviar coleção privada';await due();fail=true;await run();const beforeRevoke=messages.length;
 await collections.shareCollection(owner,a,false);fail=false;await run(new Date(now.getTime()+16*60000));assert.equal(messages.length,beforeRevoke);
 assert.equal((await following.followedCollections(reader)).find(f=>f.id===a).name,'Coleção indisponível');
 const rotated=await collections.shareCollection(owner,a,true);await following.followCollection(reader,rotated);
 assert.equal((await following.followedCollections(reader)).find(f=>f.id===a).digestEnabled,false,'new link does not restore mail consent');
 await following.setCollectionDigest(reader,a,true);catalogue[0].title='Janela expirada';await due();fail=true;await run();const beforeExpiry=messages.length;
 fail=false;await run(new Date(now.getTime()+23*60*60000));assert.equal(messages.length,beforeExpiry,'do not retry outside provider deduplication window');
 assert.equal((await sql`select status from radar_calendar_digest_job where user_id=${reader} order by created_at desc limit 1`)[0].status,'failed');
 catalogue[0].title='Limite diário';await due();process.env.RADAR_COLLECTION_DIGEST_DAILY_LIMIT='1';
 await sql`insert into radar_calendar_digest_budget(day,attempts) values(${now.toISOString().slice(0,10)}::date,1) on conflict(day) do update set attempts=1`;
 await run();assert.equal(messages.length,beforeExpiry,'durable daily budget enforced');
 await following.unfollowCollection(other,a);assert.equal((await following.followedCollections(reader)).length,2);
 await following.unfollowCollection(reader,a);assert.equal((await following.followedCollections(reader)).length,1);
 console.log(JSON.stringify({passed:true,checks:['follow idempotency','no implicit email or agenda','verified email','owner isolation','opt-in baseline','semantic changes','worker feature gate','concurrent delivery','cross-collection deduplication','public email allowlist','durable retry','same provider key and payload','unsubscribe revokes pending mail','share revocation','re-follow requires consent','23h retry cutoff','daily budget','unfollow isolation']}));
}finally{
 for(const id of users)await sql`delete from "user" where id=${id} and email=${id+'@example.test'}`;
 await sql`delete from radar_calendar_digest_budget where day>='2020-01-01' and day<'2021-01-01'`;
 await sql.end();
}
