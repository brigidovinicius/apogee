import {writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createAlertMonitor,webhookSender} from './google-calendar-alerts.mjs';

export async function syncBatch({origin,secret,fetcher=fetch,record=async()=>{},observe=async()=>{},log=console.log}) {
  const started=Date.now();
  let status,drain=false,healthy=false;
  try {
    const response=await fetcher(new URL('/api/internal/google-agenda/sync',origin),{
      method:'POST',redirect:'error',headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(170000),
    });
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json();
    if(!Number.isInteger(data.processed) || !Number.isInteger(data.due) || typeof data.healthy!=='boolean')throw Error('Invalid queue response');
    for(const key of ['processed','due','connected','lagSeconds','errors','reconnect','quota','paused','retrying'])if(data[key]!==undefined && (!Number.isSafeInteger(data[key])||data[key]<0))throw Error('Invalid queue metrics');
    healthy=data.healthy && !data.errors && !data.reconnect && !data.paused;
    status={component:'google-calendar-worker',at:new Date().toISOString(),status:healthy?'ok':'warning',
      processed:data.processed,due:data.due,connected:data.connected,lagSeconds:data.lagSeconds,
      errors:data.errors,reconnect:data.reconnect,quota:data.quota??0,paused:data.paused??0,retrying:data.retrying??0,durationMs:Date.now()-started};
    // Drain further batches immediately instead of waiting a minute per batch.
    drain=data.processed>0 && data.due>0;
  } catch {
    // Neither provider bodies nor authorization headers may reach logs.
    status={component:'google-calendar-worker',at:new Date().toISOString(),status:'failed',durationMs:Date.now()-started};
  }
  await observe(status);await record(status);log(JSON.stringify(status));return {drain,healthy};
}
export async function checkHeartbeat(path,now=Date.now()) {
  try {
    const state=JSON.parse(await readFile(path,'utf8'));
    const age=now-Date.parse(state.at);
    return state.status==='ok' && Number.isFinite(age) && age>=0 && age<240000;
  }catch{return false;}
}
async function main() {
  const file=process.env.GOOGLE_CALENDAR_WORKER_HEALTH_FILE??'/tmp/apogee-google-calendar-health.json';
  if(process.argv.includes('--healthcheck')){process.exitCode=await checkHeartbeat(file)?0:1;return;}
  const origin=process.env.GOOGLE_CALENDAR_INTERNAL_ORIGIN ?? 'http://web:3000';
  const url=new URL(origin);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid internal origin');
  const secret=process.env.GOOGLE_CALENDAR_SYNC_SECRET;
  if(!secret || secret.length<32)throw Error('Google Calendar sync secret missing');
  const observe=createAlertMonitor({file:process.env.GOOGLE_CALENDAR_ALERT_STATE_FILE??'/tmp/apogee-google-calendar-alerts.json',
    deliver:webhookSender({url:process.env.GOOGLE_CALENDAR_ALERT_WEBHOOK_URL,local:process.env.APOGEE_LOCAL_PREVIEW==='1'})});
  let stopped=false,wake;
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true;wake?.();});
  while(!stopped) {
    const result=await syncBatch({origin,secret,observe,record:state=>writeFile(file,JSON.stringify(state),{mode:0o600})});
    if(stopped)break;
    await new Promise(resolve=>{const timer=setTimeout(resolve,result.drain?1000:60000);wake=()=>{clearTimeout(timer);resolve();};});
  }
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)await main();
