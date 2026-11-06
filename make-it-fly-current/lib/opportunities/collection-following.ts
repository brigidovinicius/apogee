import 'server-only';
import {randomBytes} from 'node:crypto';
import type {TransactionSql} from 'postgres';
import {getSql} from '@/lib/members/db';
import {collectionFollowingEnabled,collectionDigestsEnabled,collectionPublicItems,sharedCollection} from './collections';
import {CollectionError,collectionIdPattern} from './collection-types';
import {digestBaseline} from './collection-digest-content';

export const FOLLOW_LIMIT=50;
export async function lockDigestUser(tx:TransactionSql,userId:string) {
 await tx`select pg_advisory_xact_lock(hashtextextended(${'calendar-digest:'+userId},0))`;
}
export async function touchDigestState(tx:TransactionSql,userId:string) {
 await tx`insert into radar_calendar_digest_state(user_id,unsubscribe_token) values(${userId},${randomBytes(24).toString('hex')}) on conflict(user_id) do nothing`;
 const cancelled=await tx`update radar_calendar_digest_job set status='cancelled',payload=null,lease_token=null,finished_at=now() where user_id=${userId} and status='pending' returning id`;
 await tx`update radar_calendar_digest_state set generation=generation+1,
  next_due_at=case when ${cancelled.length>0} then greatest(next_due_at,now()+interval '7 days') else next_due_at end where user_id=${userId}`;
}
export async function followCollection(userId:string,token:string) {
 if(!collectionFollowingEnabled())throw new CollectionError('Acompanhamento indisponível.');
 const collection=await sharedCollection(token);if(!collection)throw new CollectionError('Coleção indisponível.');
 return getSql().begin(async tx=>{
  await lockDigestUser(tx,userId);
  const [live]=await tx`select c.id from radar_calendar_collection c join "user" u on u.id=c.user_id where c.id=${collection.id} and c.share_token=${token} and c.share_version=${collection.shareVersion} and c.visibility='unlisted' and c.archived_at is null and u.blocked=false for share of c`;
  if(!live)throw new CollectionError('Este link não está mais disponível.');
  const [existing]=await tx`select share_version from radar_calendar_follow where user_id=${userId} and collection_id=${collection.id}`;
  if(Number(existing?.share_version)===collection.shareVersion)return;
  const [count]=await tx`select count(*)::int as n from radar_calendar_follow where user_id=${userId}`;
  if(!existing&&count.n>=FOLLOW_LIMIT)throw new CollectionError('Você pode acompanhar até 50 coleções.');
  await tx`insert into radar_calendar_follow(user_id,collection_id,share_version) values(${userId},${collection.id},${collection.shareVersion})
   on conflict(user_id,collection_id) do update set share_version=excluded.share_version,followed_at=now(),digest_enabled=false,consented_at=null,baseline='{}'::jsonb`;
  await touchDigestState(tx,userId);
 });
}
export async function unfollowCollection(userId:string,id:string) {
 if(!collectionIdPattern.test(id))throw new CollectionError('Coleção inválida.');
 await getSql().begin(async tx=>{await lockDigestUser(tx,userId);await tx`delete from radar_calendar_follow where user_id=${userId} and collection_id=${id}`;await touchDigestState(tx,userId);});
}
export async function followedCollections(userId:string) {
 const rows=await getSql()`select f.collection_id,f.digest_enabled,f.share_version,c.name,c.description,c.cover,c.share_token,
  (c.visibility='unlisted' and c.archived_at is null and c.share_version=f.share_version and u.blocked=false) as available
  from radar_calendar_follow f join radar_calendar_collection c on c.id=f.collection_id join "user" u on u.id=c.user_id
  where f.user_id=${userId} order by f.followed_at desc,f.collection_id`;
 return rows.map(r=>({id:String(r.collection_id),available:!!r.available,name:r.available?String(r.name):'Coleção indisponível',
  description:r.available?String(r.description):'',token:r.available?String(r.share_token):null,digestEnabled:!!r.available&&!!r.digest_enabled}));
}
export async function setCollectionDigest(userId:string,id:string,enabled:boolean) {
 if(!collectionIdPattern.test(id))throw new CollectionError('Coleção inválida.');
 if(enabled&&!collectionDigestsEnabled())throw new CollectionError('Resumos indisponíveis.');
 const follows=enabled?await followedCollections(userId):[];
 const follow=follows.find(f=>f.id===id&&f.available);
 if(enabled&&!follow)throw new CollectionError('Acompanhe uma coleção disponível primeiro.');
 const baseline=enabled?digestBaseline(await collectionPublicItems(id)):{};
 await getSql().begin(async tx=>{
  await lockDigestUser(tx,userId);
  if(enabled){
   const [user]=await tx`select email_verified,blocked from "user" where id=${userId} for share`;
   if(!user?.email_verified||user.blocked)throw new CollectionError('Confirme seu e-mail antes de ativar os resumos.');
   const [valid]=await tx`select c.id from radar_calendar_follow f join radar_calendar_collection c on c.id=f.collection_id join "user" u on u.id=c.user_id
    where f.user_id=${userId} and c.id=${id} and c.share_token=${follow!.token} and c.visibility='unlisted' and c.share_version=f.share_version and c.archived_at is null and u.blocked=false for share of c`;
   if(!valid)throw new CollectionError('Coleção indisponível.');
  }
  const rows=await tx`update radar_calendar_follow set digest_enabled=${enabled},consented_at=${enabled?new Date().toISOString():null},baseline=${JSON.stringify(baseline)}::jsonb
   where user_id=${userId} and collection_id=${id} and digest_enabled<>${enabled} returning collection_id`;
  if(rows.length)await touchDigestState(tx,userId);
 });
}
// Public capability only cancels mail. GET never mutates preferences.
export async function unsubscribeCollectionDigests(token:string) {
 if(!/^[a-f0-9]{48}$/.test(token))return;
 const [state]=await getSql()`select user_id from radar_calendar_digest_state where unsubscribe_token=${token}`;
 if(!state)return;
 const userId=String(state.user_id);
 await getSql().begin(async tx=>{await lockDigestUser(tx,userId);await tx`update radar_calendar_follow set digest_enabled=false,consented_at=null,baseline='{}'::jsonb where user_id=${userId}`;await touchDigestState(tx,userId);});
}
