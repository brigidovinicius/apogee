import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

function reasonsFor(status) {
  if(status.status==='failed')return [status.endpointUnavailable?'endpoint_unavailable':'worker_unavailable'];
  const reasons=[];
  if(status.status==='warning')reasons.push('queue_unhealthy');
  if(status.workerStale)reasons.push('worker_stale');
  if(status.capacityPressure)reasons.push('capacity_pressure');
  for(const [key,reason] of [['quota','quota'],['reconnect','reconnect'],['paused','retries_paused'],['errors','sync_errors']])if(status[key]>0)reasons.push(reason);
  return reasons;
}
function safeMetrics(status) {
  return Object.fromEntries(['due','ready','connected','lagSeconds','errors','reconnect','quota','paused','retrying','sampleSize','p95DurationMs','estimatedDrainSeconds'].map(key=>
    [key,Number.isSafeInteger(status[key])&&status[key]>=0?status[key]:['p95DurationMs','estimatedDrainSeconds'].includes(key)?null:0]));
}
export function webhookSender({url,local=false,fetcher=fetch}) {
  if(!url)return null;
  let target;try{target=new URL(url);}catch{throw Error('Invalid calendar alert destination');}
  if(target.username||target.password||target.hash || (target.protocol!=='https:' && !(local&&target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname))))throw Error('Invalid calendar alert destination');
  return async payload=>{
    const response=await fetcher(target,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Idempotency-Key':payload.eventId},
      body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Alert delivery failed');
  };
}
export function createAlertMonitor({file,deliver=null,log=console.log,now=Date.now,random=Math.random,component='google-calendar-alert'}) {
  if(!['google-calendar-alert','google-calendar-external-monitor'].includes(component))throw Error('Invalid calendar alert component');
  let state,loaded=false;
  function enqueue(event,observedAt) {
    if(!deliver)return;
    // Bound disk/memory during a prolonged receiver outage and flapping health.
    // Keep the oldest unacknowledged event plus a summary of newer changes.
    if(state.outbox.length>=64) {
      const removed=state.outbox.splice(1);
      event.coalescedEvents=removed.reduce((n,item)=>n+1+(item.event.coalescedEvents??0),0);
      event.reconcileComponent=true;
    }
    // A fresh event is eligible in this observation, even if the wall clock advances.
    state.outbox.push({event,attempts:0,notBefore:observedAt});
  }
  async function persist() {
    await mkdir(dirname(file),{recursive:true,mode:0o700});
    await writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});
    await rename(file+'.tmp',file);
  }
  return async status=>{
    if(!loaded) {
      try {state=JSON.parse(await readFile(file,'utf8'));if(state.version!==1||!Array.isArray(state.outbox))throw Error('Invalid alert state');}
      catch(error){if(error.code!=='ENOENT')throw Error('Calendar alert state unavailable');state={version:1,active:null,outbox:[]};}
      loaded=true;
    }
    const time=now(),reasons=reasonsFor(status),metrics=safeMetrics(status);
    if(reasons.length && !state.active) {
      state.active={id:randomUUID(),at:new Date(time).toISOString(),reasons,transportQueued:!!deliver};
      const event={component,type:'opened',eventId:randomUUID(),incidentId:state.active.id,at:state.active.at,reasons,metrics};
      enqueue(event,time);
      log(JSON.stringify(event));
    }else if(reasons.length && state.active && deliver && !state.active.transportQueued) {
      enqueue({component,type:'opened',eventId:randomUUID(),incidentId:state.active.id,at:new Date(time).toISOString(),reasons,metrics},time);
      state.active.transportQueued=true;
    }else if(!reasons.length && state.active) {
      const event={component,type:'recovered',eventId:randomUUID(),incidentId:state.active.id,at:new Date(time).toISOString(),reasons:state.active.reasons,metrics};
      if(state.active.transportQueued)enqueue(event,time);
      log(JSON.stringify(event));state.active=null;
    }
    // Persist before transmission; a crash retries the same idempotency key.
    await persist();
    const next=state.outbox[0];
    if(deliver && next && next.notBefore<=time) {
      try {await deliver(next.event);state.outbox.shift();}
      catch {
        next.attempts=Math.min(30,next.attempts+1);
        const delay=Math.min(3600000,60000*2**Math.min(next.attempts-1,10));
        next.notBefore=time+Math.min(3600000,delay+Math.floor(delay*0.25*random()));
        log(JSON.stringify({component,type:'delivery_failed',at:new Date(time).toISOString(),attempt:next.attempts}));
      }
      await persist();
    }
  };
}
