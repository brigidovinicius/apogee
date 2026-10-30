import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createAlertMonitor,webhookSender} from './google-calendar-alerts.mjs';

function integer(value,fallback,min,max) {
  const n=Number(value??fallback);if(!Number.isInteger(n)||n<min||n>max)throw Error('Invalid monitor configuration');return n;
}
export function monitorConfig(env=process.env) {
  let origin;try{origin=new URL(env.GOOGLE_CALENDAR_MONITOR_ORIGIN);}catch{throw Error('Invalid monitor configuration');}
  const local=env.APOGEE_LOCAL_PREVIEW==='1',loopback=url=>['127.0.0.1','localhost'].includes(url.hostname);
  if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||
    (!local&&origin.protocol!=='https:')||(local&&(!loopback(origin)||!['http:','https:'].includes(origin.protocol))))throw Error('Invalid monitor configuration');
  const secret=env.GOOGLE_CALENDAR_MONITOR_SECRET;
  if(!secret||secret.length<32)throw Error('Invalid monitor configuration');
  const webhook=env.GOOGLE_CALENDAR_MONITOR_ALERT_WEBHOOK_URL;
  if(local&&webhook){let target;try{target=new URL(webhook);}catch{throw Error('Invalid monitor configuration');}if(!loopback(target))throw Error('Invalid monitor configuration');}
  return {origin:origin.origin,secret,local,webhook,
    intervalSeconds:integer(env.GOOGLE_CALENDAR_MONITOR_INTERVAL_SECONDS,60,10,300),
    timeoutMs:integer(env.GOOGLE_CALENDAR_MONITOR_TIMEOUT_MS,10000,1000,30000),
    workerMaxAgeSeconds:integer(env.GOOGLE_CALENDAR_WORKER_MAX_AGE_SECONDS,240,180,3600),
    drainBudgetSeconds:integer(env.GOOGLE_CALENDAR_MONITOR_DRAIN_BUDGET_SECONDS,900,1,86400)};
}
async function boundedJson(response) {
  if(!response.body)throw Error('Missing monitor response');
  const reader=response.body.getReader(),chunks=[];let length=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>65536)throw Error('Monitor response too large');chunks.push(value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function pollGoogleCalendar({origin,secret,fetcher=fetch,now=Date.now,timeoutMs=10000,workerMaxAgeSeconds=240,drainBudgetSeconds=900}) {
  const at=new Date(now()).toISOString();
  try {
    const response=await fetcher(new URL('/api/internal/google-agenda/sync',origin),{method:'GET',redirect:'error',cache:'no-store',headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(timeoutMs)});
    if(![200,503].includes(response.status))throw Error('Monitor HTTP failure');
    const data=await boundedJson(response);
    if(typeof data?.healthy!=='boolean'||typeof data.workerHealthy!=='boolean')throw Error('Invalid monitor response');
    const metrics={};for(const key of ['connected','due','ready','lagSeconds','errors','reconnect','quota','paused','retrying']){
      if(!Number.isSafeInteger(data[key])||data[key]<0)throw Error('Invalid monitor metrics');metrics[key]=data[key];
    }
    const capacity=data.capacity;
    if(!capacity||!Number.isSafeInteger(capacity.providerAttempts)||capacity.providerAttempts<0||typeof capacity.estimateAvailable!=='boolean')throw Error('Missing capacity metrics');
    for(const key of ['p95DurationMs','estimatedDrainSeconds'])if(capacity[key]!==null&&(!Number.isSafeInteger(capacity[key])||capacity[key]<0))throw Error('Invalid capacity metrics');
    if(capacity.estimateAvailable&&(capacity.p95DurationMs===null||capacity.estimatedDrainSeconds===null))throw Error('Invalid capacity estimate');
    const age=typeof data.workerHeartbeatAt==='string'?now()-Date.parse(data.workerHeartbeatAt):NaN;
    const workerStale=!Number.isFinite(age)||age<0||age>workerMaxAgeSeconds*1000;
    const capacityPressure=capacity.estimateAvailable&&capacity.estimatedDrainSeconds>drainBudgetSeconds;
    const healthy=response.status===200&&data.healthy&&data.workerHealthy&&!workerStale&&!capacityPressure&&metrics.errors===0&&metrics.reconnect===0&&metrics.paused===0;
    const capacityMetrics={estimateAvailable:capacity.estimateAvailable};
    for(const key of ['windowMinutes','minimumSamples','attempts','providerAttempts','synced','partial','failed','meanDurationMs','p95DurationMs','googleCalls','httpErrors','networkErrors','quotaResponses','eventsChanged','estimatedDrainSeconds','estimatedFullSyncsPer15Minutes'])capacityMetrics[key]=Number.isSafeInteger(capacity[key])&&capacity[key]>=0?capacity[key]:null;
    for(const key of ['successRate','observedSyncedPerMinute'])capacityMetrics[key]=typeof capacity[key]==='number'&&Number.isFinite(capacity[key])&&capacity[key]>=0?capacity[key]:null;
    if(capacityMetrics.successRate>1)capacityMetrics.successRate=null;
    return {component:'google-calendar-external-monitor',at,status:healthy?'ok':'warning',...metrics,workerStale,capacityPressure,
      sampleSize:capacity.providerAttempts,p95DurationMs:capacity.p95DurationMs,estimatedDrainSeconds:capacity.estimatedDrainSeconds,capacity:capacityMetrics};
  }catch{return {component:'google-calendar-external-monitor',at,status:'failed',endpointUnavailable:true};}
}
export async function checkMonitorSnapshot(file,maxAgeSeconds=180,now=Date.now()) {
  try{const state=JSON.parse(await readFile(file,'utf8')),age=now-Date.parse(state.at);return ['ok','warning','failed'].includes(state.status)&&Number.isFinite(age)&&age>=0&&age<=maxAgeSeconds*1000;}catch{return false;}
}
async function main() {
  const file=process.env.GOOGLE_CALENDAR_MONITOR_SNAPSHOT_FILE??'/tmp/apogee-google-calendar-monitor.json';
  const interval=integer(process.env.GOOGLE_CALENDAR_MONITOR_INTERVAL_SECONDS,60,10,300);
  if(process.argv.includes('--healthcheck')){process.exitCode=await checkMonitorSnapshot(file,interval*2+40)?0:1;return;}
  if(process.argv.slice(2).some(arg=>arg!=='--once'))throw Error('Invalid monitor arguments');
  const config=monitorConfig();
  const observe=createAlertMonitor({file:process.env.GOOGLE_CALENDAR_MONITOR_STATE_FILE??'/tmp/apogee-google-calendar-monitor-alerts.json',
    component:'google-calendar-external-monitor',deliver:webhookSender({url:config.webhook,local:config.local})});
  let stopped=false,wake;
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{stopped=true;wake?.();});
  while(!stopped) {
    const status=await pollGoogleCalendar(config);await observe(status);
    await mkdir(dirname(file),{recursive:true,mode:0o700});await writeFile(file+'.tmp',JSON.stringify(status),{mode:0o600});await rename(file+'.tmp',file);
    console.log(JSON.stringify(status));
    if(process.argv.includes('--once')){process.exitCode=status.status==='ok'?0:1;return;}
    await new Promise(resolve=>{const timer=setTimeout(resolve,config.intervalSeconds*1000);wake=()=>{clearTimeout(timer);resolve();};});
  }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{
  console.log(JSON.stringify({component:'google-calendar-external-monitor',status:'configuration_or_state_error'}));process.exitCode=2;
});
