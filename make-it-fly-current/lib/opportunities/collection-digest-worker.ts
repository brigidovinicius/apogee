import 'server-only';
import {randomUUID} from 'node:crypto';
import type {TransactionSql} from 'postgres';
import {getSql} from '@/lib/members/db';
import {applicationOrigin,memberMailAvailable,sendMemberMail} from '@/lib/members/mail';
import {adultAccess} from '@/lib/members/protection';
import {radarAccess} from '@/lib/billing/store';
import {collectionDigestsEnabled} from './collections';
import {lockDigestUser} from './collection-following';
import {digestBaseline,digestChanges,digestFingerprint,type DigestBaseline} from './collection-digest-content';
import {listRadarOpportunities} from './radar-client';
import {opportunityCardData} from './card-data';
import type {StudentOpportunity} from './types';

type Checkpoint={id:string;version:number;baseline:DigestBaseline};
type Payload={to:string;text:string;checkpoints:Checkpoint[];items:{id:string;hash:string}[]};
const WEEK=7*24*60*60*1000;
const RETRY_WINDOW=23*60*60*1000;
const subject='Novidades nas coleções que você acompanha · Apogee';
async function activeFollows(tx:TransactionSql,userId:string) {
 return tx`select c.id,c.name,c.share_version,f.baseline from radar_calendar_follow f
  join radar_calendar_collection c on c.id=f.collection_id join "user" owner on owner.id=c.user_id
  where f.user_id=${userId} and f.digest_enabled=true and c.share_version=f.share_version
  and c.visibility='unlisted' and c.archived_at is null and owner.blocked=false order by c.id for share of c`;
}
async function finish(tx:TransactionSql,userId:string,id:string,status:string,now:Date) {
 await tx`update radar_calendar_digest_job set status=${status},payload=null,lease_token=null,finished_at=${now.toISOString()} where id=${id}`;
 await tx`update radar_calendar_digest_state set next_due_at=${new Date(now.getTime()+WEEK).toISOString()} where user_id=${userId}`;
}
async function prepare(userId:string,items:StudentOpportunity[],now:Date,dailyLimit:number) {
 return getSql().begin(async tx=>{
  await lockDigestUser(tx,userId);
  const [state]=await tx`select * from radar_calendar_digest_state where user_id=${userId} and next_due_at<=${now.toISOString()}`;
  if(!state)return null;
  const [recipient]=await tx`select email,email_verified,blocked from "user" where id=${userId} for share`;
  const follows=await activeFollows(tx,userId);
  const [existing]=await tx`select * from radar_calendar_digest_job where user_id=${userId} and period_start=${new Date(state.next_due_at).toISOString()}`;
  if(!recipient?.email_verified||recipient.blocked||!follows.length){
   if(existing)await finish(tx,userId,String(existing.id),'cancelled',now);
   else await tx`update radar_calendar_digest_state set next_due_at=${new Date(now.getTime()+WEEK).toISOString()} where user_id=${userId}`;
   return null;
  }
  let job=existing;
  if(!job){
   const changes=new Map<string,{id:string;title:string;change:string}>(),checkpoints:Checkpoint[]=[];
   for(const follow of follows){
    const refs=await tx`select opportunity_id from radar_calendar_collection_item where collection_id=${String(follow.id)}`;
    const ids=new Set(refs.map(r=>String(r.opportunity_id))),current=items.filter(i=>ids.has(i.id));
    checkpoints.push({id:String(follow.id),version:Number(follow.share_version),baseline:digestBaseline(current)});
    for(const change of digestChanges(current,follow.baseline as DigestBaseline))changes.set(change.id,change);
   }
   const id=randomUUID(),origin=applicationOrigin();
   const allChanges=[...changes.values()].sort((a,b)=>a.id.localeCompare(b.id));
   const visible=allChanges.slice(0,20);
   const text=['Estas são as novidades das coleções com resumo semanal ativado.','',
    ...visible.flatMap(i=>[i.change+': '+i.title,origin+'/membros/oportunidades/'+encodeURIComponent(i.id),'']),
    ...(allChanges.length>20?[`Há mais ${allChanges.length-20} novidades nas suas coleções.`,'']:[]),
    'Ver coleções e preferências: '+origin+'/membros/colecoes/acompanhadas',
    'Cancelar todos os resumos: '+origin+'/colecoes/resumos/cancelar/'+state.unsubscribe_token].join('\n');
   const payload:Payload={to:String(recipient.email),text,checkpoints,items:visible.map(i=>({id:i.id,hash:digestFingerprint(items.find(item=>item.id===i.id)!)}))};
   const [created]=await tx`insert into radar_calendar_digest_job(id,user_id,period_start,generation,payload,created_at,next_attempt_at)
    values(${id},${userId},${new Date(state.next_due_at).toISOString()},${Number(state.generation)},${JSON.stringify(payload)}::jsonb,${now.toISOString()},${now.toISOString()}) returning *`;
   job=created;
   if(!allChanges.length){
    for(const cp of checkpoints)await tx`update radar_calendar_follow set baseline=${JSON.stringify(cp.baseline)}::jsonb where user_id=${userId} and collection_id=${cp.id}`;
    await finish(tx,userId,id,'empty',now);return null;
   }
  }
  if(job.status!=='pending')return null;
  if(Number(job.generation)!==Number(state.generation)){await finish(tx,userId,String(job.id),'cancelled',now);return null;}
  if(now.getTime()-new Date(job.created_at).getTime()>=RETRY_WINDOW||Number(job.attempts)>=5){await finish(tx,userId,String(job.id),'failed',now);return null;}
  if(new Date(job.next_attempt_at)>now)return null;
  // Durable reservation precedes network I/O, so crashes cannot reset the budget or retry window.
  await tx`select pg_advisory_xact_lock(hashtextextended('calendar-digest-budget',0))`;
  const day=now.toISOString().slice(0,10);
  await tx`insert into radar_calendar_digest_budget(day) values(${day}::date) on conflict do nothing`;
  const reserved=await tx`update radar_calendar_digest_budget set attempts=attempts+1 where day=${day}::date and attempts<${dailyLimit} returning day`;
  if(!reserved.length)return null;
  const lease=randomUUID();
  await tx`update radar_calendar_digest_job set attempts=attempts+1,next_attempt_at=${new Date(now.getTime()+15*60*1000).toISOString()},lease_token=${lease} where id=${String(job.id)}`;
  return {id:String(job.id),lease};
 });
}
async function deliver(userId:string,claim:{id:string;lease:string},items:StudentOpportunity[],now:Date) {
 return getSql().begin(async tx=>{
  await lockDigestUser(tx,userId);
  const [job]=await tx`select j.*,s.generation as current_generation from radar_calendar_digest_job j join radar_calendar_digest_state s on s.user_id=j.user_id
   where j.id=${claim.id} and j.user_id=${userId} and j.status='pending' and j.lease_token=${claim.lease}`;
  if(!job)return 'skipped';
  const [recipient]=await tx`select email,email_verified,blocked from "user" where id=${userId} for share`;
  const follows=await activeFollows(tx,userId),payload=job.payload as Payload;
  let valid=collectionDigestsEnabled()&&process.env.RADAR_COLLECTION_DIGEST_WORKER_ENABLED==='true'&&recipient?.email_verified&&!recipient.blocked&&recipient.email===payload.to&&Number(job.generation)===Number(job.current_generation);
  for(const cp of payload.checkpoints){
   if(!follows.some(f=>f.id===cp.id&&Number(f.share_version)===cp.version)){valid=false;break;}
   // Removing an event from a collection revokes that queued content too.
   const refs=await tx`select opportunity_id from radar_calendar_collection_item where collection_id=${cp.id}`;
   const ids=new Set(refs.map(r=>String(r.opportunity_id)));
   if(Object.keys(cp.baseline).some(id=>!ids.has(id)))valid=false;
  }
  if(payload.items.some(i=>!items.some(current=>current.id===i.id&&digestFingerprint(current)===i.hash)))valid=false;
  if(!valid){await finish(tx,userId,claim.id,'cancelled',now);return 'cancelled';}
  try{await sendMemberMail({to:payload.to,subject,text:payload.text,key:'calendar-digest-'+claim.id});}
  catch{await tx`update radar_calendar_digest_job set lease_token=null where id=${claim.id}`;return 'retry';}
  for(const cp of payload.checkpoints)await tx`update radar_calendar_follow set baseline=${JSON.stringify(cp.baseline)}::jsonb where user_id=${userId} and collection_id=${cp.id} and share_version=${cp.version} and digest_enabled=true`;
  await finish(tx,userId,claim.id,'accepted',now);return 'accepted';
 });
}
export async function runCollectionDigests({now=new Date(),limit=5}:{now?:Date;limit?:number}={}) {
 const result={enabled:false,checked:0,accepted:0,retry:0,cancelled:0};
 if(!collectionDigestsEnabled()||process.env.RADAR_COLLECTION_DIGEST_WORKER_ENABLED!=='true'||!memberMailAvailable())return result;
 result.enabled=true;
 const configured=Number(process.env.RADAR_COLLECTION_DIGEST_DAILY_LIMIT??10);
 const dailyLimit=Number.isInteger(configured)&&configured>=1?Math.min(configured,50):10;
 const rows=await getSql()`select s.user_id from radar_calendar_digest_state s where s.next_due_at<=${now.toISOString()}
  and not exists(select 1 from radar_calendar_digest_job j where j.user_id=s.user_id and j.period_start=s.next_due_at and j.status='pending' and j.next_attempt_at>${now.toISOString()})
  order by s.next_due_at,s.user_id limit ${Math.max(1,Math.min(10,Math.trunc(limit)||5))}`;
 if(!rows.length)return result;
 // Strict catalogue loading: an outage must not become an empty baseline.
 const items=(await listRadarOpportunities(true)).map(opportunityCardData);
 for(const row of rows){
  const userId=String(row.user_id);result.checked++;
  if(!await adultAccess(userId)||!(await radarAccess(userId,process.env.STRIPE_MODE!=='test')).active){
   await getSql().begin(async tx=>{
    await lockDigestUser(tx,userId);
    await tx`update radar_calendar_digest_job set status='cancelled',payload=null,lease_token=null,finished_at=${now.toISOString()} where user_id=${userId} and status='pending'`;
    await tx`update radar_calendar_digest_state set next_due_at=${new Date(now.getTime()+WEEK).toISOString()} where user_id=${userId}`;
   });
   continue;
  }
  const claim=await prepare(userId,items,now,dailyLimit);if(!claim)continue;
  const status=await deliver(userId,claim,items,now);
  if(status==='accepted'||status==='retry'||status==='cancelled')result[status]++;
 }
 return result;
}
