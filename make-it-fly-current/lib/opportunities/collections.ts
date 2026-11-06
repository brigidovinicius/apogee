import 'server-only';
import { randomBytes,randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { getSql } from '@/lib/members/db';
import { requireCalendarMember,personalCalendarEnabled } from './personal-calendar';
import { listRadarOpportunities } from './radar-client';
import { opportunityCardData } from './card-data';
import { CollectionError,COLLECTION_LIMIT,COLLECTION_ITEM_LIMIT,collectionInput,collectionIdPattern,collectionTokenPattern,type CalendarCollection } from './collection-types';

export const collectionsEnabled=()=>personalCalendarEnabled()&&process.env.RADAR_COLLECTIONS_ENABLED==='true';
export const collectionSharingEnabled=()=>collectionsEnabled()&&process.env.RADAR_COLLECTION_SHARING_ENABLED==='true';
export const collectionFollowingEnabled=()=>collectionSharingEnabled()&&process.env.RADAR_COLLECTION_FOLLOWING_ENABLED==='true';
export const collectionDigestsEnabled=()=>collectionFollowingEnabled()&&process.env.RADAR_COLLECTION_DIGEST_ENABLED==='true';
export async function requireCollectionMember(path='/membros/colecoes') {if(!collectionsEnabled())notFound();return requireCalendarMember(path);}
function validId(id:string){if(!collectionIdPattern.test(id))throw new CollectionError('Coleção indisponível.');}
function rowCollection(row:Record<string,unknown>):CalendarCollection {
 return {id:String(row.id),name:String(row.name),description:String(row.description),cover:row.cover as CalendarCollection['cover'],visibility:row.visibility as CalendarCollection['visibility'],
 shareToken:row.share_token?String(row.share_token):null,shareVersion:Number(row.share_version),archivedAt:row.archived_at?new Date(String(row.archived_at)).toISOString():null,itemCount:Number(row.item_count??0)};
}
export async function listOwnedCollections(userId:string,archived=false) {
 const rows=await getSql()`select c.*, (select count(*) from radar_calendar_collection_item i where i.collection_id=c.id)::int as item_count
 from radar_calendar_collection c where c.user_id=${userId} and (c.archived_at is not null)=${archived} order by c.updated_at desc,c.id`;
 return rows.map(rowCollection);
}
export async function ownedCollection(userId:string,id:string) {
 if(!collectionIdPattern.test(id))return null;
 const [row]=await getSql()`select c.*,(select count(*) from radar_calendar_collection_item i where i.collection_id=c.id)::int as item_count
 from radar_calendar_collection c where c.id=${id} and c.user_id=${userId} and c.archived_at is null`;
 return row?rowCollection(row):null;
}
export async function createCollection(userId:string,input:Parameters<typeof collectionInput>[0]) {
 const data=collectionInput(input),id=randomUUID();
 await getSql().begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended(${'collections:'+userId},0))`;
  const [count]=await tx`select count(*)::int as n from radar_calendar_collection where user_id=${userId} and archived_at is null`;
  if(count.n>=COLLECTION_LIMIT)throw new CollectionError('Você pode manter até 20 coleções ativas.');
  await tx`insert into radar_calendar_collection(id,user_id,name,description,cover) values(${id},${userId},${data.name},${data.description},${data.cover})`;
 });
 return id;
}
export async function updateCollection(userId:string,id:string,input:Parameters<typeof collectionInput>[0]) {
 validId(id);const data=collectionInput(input);
 const rows=await getSql()`update radar_calendar_collection set name=${data.name},description=${data.description},cover=${data.cover},updated_at=now()
 where id=${id} and user_id=${userId} and archived_at is null returning id`;
 if(!rows.length)throw new CollectionError('Coleção indisponível.');
}
export async function archiveCollection(userId:string,id:string,archived:boolean) {
 validId(id);
 await getSql().begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended(${'collections:'+userId},0))`;
  if(!archived){const [count]=await tx`select count(*)::int as n from radar_calendar_collection where user_id=${userId} and archived_at is null`;if(count.n>=COLLECTION_LIMIT)throw new CollectionError('Arquive uma coleção antes de restaurar outra.');}
  const rows=await tx`update radar_calendar_collection set archived_at=${archived?new Date().toISOString():null},visibility='private',share_token=null,share_version=share_version+1,updated_at=now()
  where id=${id} and user_id=${userId} and (archived_at is not null)=${!archived} returning id`;
  if(!rows.length)throw new CollectionError('Coleção indisponível.');
 });
}
export async function setCollectionItem(userId:string,id:string,opportunityId:string,present:boolean) {
 validId(id);if(!/^radar-[a-zA-Z0-9_-]{1,194}$/.test(opportunityId))throw new CollectionError('Oportunidade inválida.');
 // Check ownership before touching the remote catalogue.
 if(!await ownedCollection(userId,id))throw new CollectionError('Coleção indisponível.');
 const item=present?(await listRadarOpportunities(true)).find(i=>i.id===opportunityId):null;
 if(present&&!item)throw new CollectionError('Oportunidade indisponível no catálogo.');
 await getSql().begin(async tx=>{
  const [owner]=await tx`select id from radar_calendar_collection where id=${id} and user_id=${userId} and archived_at is null for update`;
  if(!owner)throw new CollectionError('Coleção indisponível.');
  if(present){
   const existing=await tx`select opportunity_id from radar_calendar_collection_item where collection_id=${id} and opportunity_id=${opportunityId}`;
   if(existing.length)return;
   const [count]=await tx`select count(*)::int as n from radar_calendar_collection_item where collection_id=${id}`;
   if(count.n>=COLLECTION_ITEM_LIMIT)throw new CollectionError('Esta coleção pode ter até 200 oportunidades.');
   await tx`insert into radar_calendar_collection_item(collection_id,opportunity_id,title) values(${id},${opportunityId},${item!.title.slice(0,500)}) on conflict do nothing`;
  }else await tx`delete from radar_calendar_collection_item where collection_id=${id} and opportunity_id=${opportunityId}`;
  await tx`update radar_calendar_collection set updated_at=now() where id=${id}`;
 });
}
export async function collectionItems(id:string) {
 validId(id);
 const rows=await getSql()`select opportunity_id,title from radar_calendar_collection_item where collection_id=${id} order by added_at,opportunity_id`;
 return rows.map(row=>({id:String(row.opportunity_id),title:String(row.title)}));
}
export async function shareCollection(userId:string,id:string,enabled:boolean,rotate=false) {
 if(!collectionSharingEnabled())throw new CollectionError('Compartilhamento indisponível.');
 validId(id);
 return getSql().begin(async tx=>{
  const [row]=await tx`select share_token,visibility from radar_calendar_collection where id=${id} and user_id=${userId} and archived_at is null for update`;
  if(!row)throw new CollectionError('Coleção indisponível.');
  if(enabled&&row.visibility==='unlisted'&&!rotate)return String(row.share_token);
  const token=enabled?randomBytes(24).toString('hex'):null;
  await tx`update radar_calendar_collection set visibility=${enabled?'unlisted':'private'},share_token=${token},share_version=share_version+1,updated_at=now() where id=${id}`;
  return token;
 });
}
export async function sharedCollection(token:string) {
 if(!collectionSharingEnabled()||!collectionTokenPattern.test(token))return null;
 const [row]=await getSql()`select c.* from radar_calendar_collection c join "user" u on u.id=c.user_id
 where c.share_token=${token} and c.visibility='unlisted' and c.archived_at is null and u.blocked=false`;
 return row?rowCollection(row):null;
}
export async function collectionPublicItems(id:string) {
 const refs=await collectionItems(id),ids=new Set(refs.map(i=>i.id));
 const live=await listRadarOpportunities(true);
 return live.filter(i=>ids.has(i.id)).map(opportunityCardData);
}
