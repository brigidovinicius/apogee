import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withAdminTransaction } from '@/lib/db/client';
import { publishedOpportunityPredicate } from '@/lib/db/publication-filter';
import type { Discovery } from '@/lib/ingestion/discovery';
import { alertsAvailable } from './mail';
import { AlertError,normalizedAlertEmail,tokenHash,fingerprint,links,allowance } from './subscription-core';

const verifiedTarget=`target.enabled and target.kind in ('event_series','program')
  and target.official_verified_at is not null and target.official_verified_url=target.official_url`;
const mappingReady=`exists(select 1 from official_sources mapped where mapped.id=target.mapped_source_id and mapped.active and mapped.verification_status='verified')`;
type Series={id:string;name:string;organizer:string;mapped_source_id:string|null;official_url:string;ready:boolean};
async function series(client:PoolClient,id:string) {
  return (await client.query<Series>(`select target.id,target.name,target.organizer,target.mapped_source_id,target.official_url,${mappingReady} as ready
    from discovery_targets target where target.id=$1 and ${verifiedTarget}`,[id])).rows[0]??null;
}
export async function seriesIsAvailable(client:PoolClient,id:string) {return Boolean((await series(client,id))?.ready);}
export async function listPublicSeries() {
  return withAdminTransaction(async client=>(await client.query(`select target.id,target.name,target.organizer,
    target.last_checked_at as "lastCheckedAt",target.last_status as "checkStatus",${mappingReady} as ready
    from discovery_targets target where ${verifiedTarget} order by target.name,target.id limit 300`)).rows
    .map(({ready,...row})=>({...row,alertsAvailable:alertsAvailable()&&ready===true})));
}
// A discovery portal may contain unrelated calls. Only an explicit source-to-series
// mapping establishes membership; URL/domain similarity and discovery origin do not.
async function knownEditions(client:PoolClient,target:Series) {
  const rows=(await client.query<{id:string;title:string;discovery:Discovery;live:boolean;terminal:boolean}>(`select o.id,o.title,o.discovery,
    o.opportunity_status in ('closed','cancelled','suspended','result_published') as terminal,
    (${publishedOpportunityPredicate} and o.opportunity_status='open') as live from opportunities o
    join official_sources source on source.id=o.official_source_id and source.active and source.verification_status='verified'
    where o.official_source_id=$1 and o.verified_at is not null and o.verification_method in ('automatic','admin')
      and o.review_status in ('approved','needs_information') and not o.source_conflict and o.deleted_at is null
      and ((${publishedOpportunityPredicate} and o.opportunity_status='open')
        or (o.opportunity_status in ('closed','cancelled','suspended','result_published')
          and (o.publication_issue is null or o.publication_issue in ('status_unconfirmed','invalid_deadline'))))
    order by o.created_at,o.id`,[target.mapped_source_id])).rows;
  return rows.flatMap(row=>{
    const editions=row.discovery?.editions??[];
    // With no explicit edition metadata, a distinct validated ficha is the only
    // identity available. Never infer a new edition from a title/date correction.
    if(!editions.length)return [{id:row.id,key:'opportunity:'+row.id,explicit:false,title:row.title,open:row.live,ended:false,remember:row.live||row.terminal}];
    return editions.map(edition=>{
      const now=Date.now();
      const windows=edition.stages.filter(stage=>stage.kind==='registration').map(stage=>{
        // A single registration date is its deadline, as in the calendar view.
        // Only a full interval establishes a future opening boundary.
        const start=stage.end?Date.parse(stage.start.length===10?stage.start+'T00:00:00-03:00':stage.start):-Infinity;
        const until=stage.end??stage.start;
        const end=Date.parse(until.length===10?until+'T23:59:59.999-03:00':until);
        return {start,end};
      });
      const open=row.live&&(windows.length?windows.some(w=>w.start<=now&&now<=w.end):editions.length===1);
      const ended=windows.length>0&&windows.every(w=>w.end<now);
      return {id:row.id,key:'edition:'+edition.id,title:row.title+' — '+edition.name,explicit:true,open,ended,
        // Future registration windows must remain pending until they open.
        remember:open||ended||(row.terminal&&!windows.some(w=>w.start>now))};
    });
  });
}
export async function subscribeToSeries(input:Record<string,unknown>) {
  if(!alertsAvailable())throw new AlertError('Avisos por e-mail ainda não estão disponíveis',503);
  const email=normalizedAlertEmail(input.email);
  if(typeof input.targetId!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(input.targetId)||input.consent!==true)throw new AlertError('Confirme que deseja acompanhar próximas edições');
  return withAdminTransaction(async client=>{
    await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[`series:${input.targetId}:${email}`]);
    const target=await series(client,String(input.targetId));
    if(!target?.ready)throw new AlertError('Acompanhamento indisponível para esta competição',409);
    if(!await allowance(client,'subscribe:global',100,86400)||!await allowance(client,`subscribe:${tokenHash(email)}`,3,3600))return {ok:true};
    const old=(await client.query('select id,status,confirm_expires_at from opportunity_alert_subscriptions where target_id=$1 and email=$2 for update',[target.id,email])).rows[0];
    if(old?.status==='active'||old?.status==='pending'&&new Date(old.confirm_expires_at)>new Date())return {ok:true};
    const confirm=randomBytes(32).toString('hex'),unsubscribe=randomBytes(32).toString('hex');
    const editions=await knownEditions(client,target);
    const seen=[...new Set(editions.filter(e=>e.remember).flatMap(e=>[e.key,'opportunity:'+e.id,...(e.explicit?['metadata:'+e.id]:[])]))];
    const pending=editions.filter(e=>!e.remember).map(e=>e.key);
    const saved=await client.query<{id:string}>(`insert into opportunity_alert_subscriptions(target_id,email,confirm_hash,unsubscribe_hash,unsubscribe_token,confirm_expires_at,last_snapshot)
      values($1,$2,$3,$4,$5,now()+interval '24 hours',$6)
      on conflict(target_id,email) do update set status='pending',confirm_hash=excluded.confirm_hash,unsubscribe_hash=excluded.unsubscribe_hash,
        unsubscribe_token=excluded.unsubscribe_token,confirm_expires_at=excluded.confirm_expires_at,last_snapshot=excluded.last_snapshot,
        consent_at=now(),confirmed_at=null,updated_at=now() returning id`,[target.id,email,tokenHash(confirm),tokenHash(unsubscribe),unsubscribe,{seen,pending}]);
    const urls=links(confirm,unsubscribe);
    await client.query("update opportunity_alert_outbox set status='cancelled',payload='{}' where subscription_id=$1 and status in ('pending','sending')",[saved.rows[0].id]);
    await client.query(`insert into opportunity_alert_outbox(subscription_id,fingerprint,kind,payload) values($1,$2,'confirmation',$3)`,
      [saved.rows[0].id,tokenHash(confirm),{subject:'Confirme os avisos de próximas edições no Radar Apogee',text:`Você solicitou acompanhar próximas edições de: ${target.name}.\n\nConfirme em até 24 horas:\n${urls.confirm}\n\nVocê receberá avisos quando uma nova edição com inscrições abertas for validada no Radar. Este acompanhamento continua entre edições até você cancelar. Alterações nesta edição exigem acompanhamento próprio.\n\nSe não foi você, ignore ou cancele:\n${urls.unsubscribe}`}]);
    return {ok:true};
  });
}
type SeriesSubscription={id:string;target_id:string;unsubscribe_token:string;last_snapshot:{seen?:string[];pending?:string[]}};
export async function queueSeriesChange(client:PoolClient,sub:SeriesSubscription) {
  const target=await series(client,sub.target_id);
  if(!target?.ready) {await client.query('update opportunity_alert_subscriptions set checked_at=now() where id=$1',[sub.id]);return 0;}
  const editions=await knownEditions(client,target);
  const seen=new Set(Array.isArray(sub.last_snapshot?.seen)?sub.last_snapshot.seen:[]);
  const pending=new Set(Array.isArray(sub.last_snapshot?.pending)?sub.last_snapshot.pending:[]);
  const fresh=[...new Map(editions.filter(e=>e.open&&!seen.has(e.key)&&
    // Adding metadata to an already known ficha establishes its baseline;
    // that enrichment alone is not evidence of a different edition.
    !(e.explicit&&seen.has('opportunity:'+e.id)&&!seen.has('metadata:'+e.id)&&!pending.has(e.key))).map(e=>[e.key,e])).values()];
  let queued=0;
  if(fresh.length) {
    const urls=links('',sub.unsubscribe_token);
    const result=await client.query(`insert into opportunity_alert_outbox(subscription_id,fingerprint,kind,payload)
      values($1,$2,'change',$3) on conflict do nothing`,[sub.id,fingerprint(['series',sub.target_id,fresh.map(e=>e.key).sort()]),{
      subject:`Radar Apogee: novas edições de ${target.name.replace(/[\r\n]/g,' ').slice(0,120)}`,
      text:`Novas edições com inscrições abertas foram validadas no Radar para ${target.name}:\n\n${fresh.map(e=>`${e.title}\nhttps://www.apogee.community/oportunidades/oportunidade--radar-${e.id}`).join('\n\n')}\n\nConfira as condições e acompanhe as alterações de cada edição na sua ficha.\n\nCancelar este acompanhamento:\n${urls.unsubscribe}`,
    }]);
    queued=result.rowCount??0;
  }
  // Retain notified IDs across closures and source outages; a recheck is never a new edition.
  for(const edition of editions) {
    // A previously future window needs confirmed public opening or its own end;
    // the aggregate ficha may still be closed while collection catches up.
    if(edition.open||edition.ended||(!pending.has(edition.key)&&edition.remember)) {
      seen.add(edition.key);seen.add('opportunity:'+edition.id);pending.delete(edition.key);
      if(edition.explicit)seen.add('metadata:'+edition.id);
    } else pending.add(edition.key);
  }
  await client.query('update opportunity_alert_subscriptions set last_snapshot=$2,checked_at=now() where id=$1',[sub.id,{seen:[...seen],pending:[...pending]}]);
  return queued;
}
