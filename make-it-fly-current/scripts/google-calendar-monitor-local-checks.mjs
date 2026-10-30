// Used only by the isolated PostgreSQL/loopback integration harness.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {opportunityLoader} from '../tests/helpers/load-opportunity-module.mjs';

export async function exerciseMonitorAndCapacity({qa,load,origin,server,directory,getApiCalls,setMonitorHang}) {
  let checks=0,worker,workerClosed,workerOutput='';const observations=[];
  const check=(condition,label)=>{assert.ok(condition,label);checks++;};
  const metrics=(await qa`select * from radar_google_calendar_metric`);
  check(metrics.some(row=>row.quota_responses>0&&row.google_calls>0),'Actual request instrumentation captured quota and calls');
  check(metrics.some(row=>row.events_changed>0&&row.outcome==='synced'),'Successful event writes were counted');
  const columns=(await qa`select column_name from information_schema.columns where table_schema=current_schema() and table_name='radar_google_calendar_metric'`).map(row=>row.column_name);
  check(!columns.some(name=>/user|account|token|email|event_id/.test(name)),'Metric schema has no account/token/event identifiers');
  await qa`delete from radar_google_calendar_metric`;
  async function seedLatency() {
    await qa`delete from radar_google_calendar_metric`;
    await qa`insert into radar_google_calendar_metric(duration_ms,outcome,google_calls,http_errors,network_errors,quota_responses,events_changed)
      select n*1000,'synced',4,0,0,0,2 from generate_series(1,25) n`;
  }
  await seedLatency();
  for(const offset of [-2880,-16,1440])await qa`insert into radar_google_calendar_metric(finished_at,duration_ms,outcome,google_calls,http_errors,network_errors,quota_responses,events_changed)
    values (now()+${offset}*interval '1 minute',100000,'failed',5,1,0,1,0)`;
  await qa`insert into radar_google_calendar_metric(duration_ms,outcome,google_calls,http_errors,network_errors,quota_responses,events_changed) values (0,'pending',0,0,0,0,0)`;
  const capacity=load('lib/opportunities/google-calendar-capacity.ts');
  const queue={ready:30,errors:0,reconnect:0,paused:0,cooldownUntil:null};
  const snapshot=await capacity.googleCapacitySnapshot(queue,3);
  check(snapshot.providerAttempts===25&&snapshot.attempts===26,'Window excludes old/future samples and distinguishes deferred attempts');
  check(snapshot.p95DurationMs===23800&&snapshot.meanDurationMs===13000,'Real PostgreSQL percentile and mean match known synthetic dataset');
  check(snapshot.googleCalls===100&&snapshot.eventsChanged===50&&snapshot.successRate===1,'Totals and rate use observed attempts');
  check(snapshot.estimatedDrainSeconds===724,'Drain estimate includes serial p95 and inter-batch gap');
  const restarted=opportunityLoader({'@/lib/members/db':{getSql:()=>qa}})('lib/opportunities/google-calendar-capacity.ts');
  check((await restarted.googleCapacitySnapshot(queue,3)).p95DurationMs===snapshot.p95DurationMs,'History survives a fresh module instance');
  const scenarios=[];
  for(const ready of [10,30,100]){const result=await capacity.googleCapacitySnapshot({...queue,ready},3);scenarios.push({syntheticReady:ready,p95DurationMs:result.p95DurationMs,estimatedDrainSeconds:result.estimatedDrainSeconds});}
  await writeFile(join(directory,'capacity-scenarios.json'),JSON.stringify({synthetic:true,scenarios}));
  await qa`insert into radar_google_calendar_metric(duration_ms,outcome,google_calls,http_errors,network_errors,quota_responses,events_changed)
    select 1,'synced',1,0,0,0,0 from generate_series(1,10025)`;
  await load('lib/opportunities/google-calendar-queue.ts').recordGoogleWorkerHeartbeat('ok');
  check((await qa`select count(*)::int as n from radar_google_calendar_metric`)[0].n<=10000,'History bound enforced with a real bulk fixture');
  check((await qa`select count(*)::int as n from radar_google_calendar_metric where finished_at<now()-interval '24 hours'`)[0].n===0,'Old metrics pruned even by an empty worker heartbeat');
  await seedLatency();
  await qa`update radar_google_calendar set refresh_token_encrypted=null,last_error=null,retry_paused=false`;
  await qa`update radar_google_calendar_queue_state set cooldown_until=null,worker_seen_at=null,worker_state=null`;
  process.env.GOOGLE_CALENDAR_MONITOR_SECRET='m'.repeat(32);
  const monitorAlerts=[],monitorKeys=[];let receiverFails=false;
  const receiver=createServer(async(req,res)=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);monitorAlerts.push(JSON.parse(Buffer.concat(chunks)));monitorKeys.push(req.headers['idempotency-key']);res.writeHead(receiverFails?503:200);res.end('{}');});
  await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
  const receiverOrigin='http://127.0.0.1:'+receiver.address().port;
  const monitorState=join(directory,'external-alerts.json'),monitorSnapshot=join(directory,'external-status.json');
  const childEnv={PATH:process.env.PATH,APOGEE_LOCAL_PREVIEW:'1',GOOGLE_CALENDAR_MONITOR_ORIGIN:origin,GOOGLE_CALENDAR_MONITOR_SECRET:'m'.repeat(32),GOOGLE_CALENDAR_MONITOR_TIMEOUT_MS:'1000',GOOGLE_CALENDAR_MONITOR_ALERT_WEBHOOK_URL:receiverOrigin+'/alerts',GOOGLE_CALENDAR_MONITOR_STATE_FILE:monitorState,GOOGLE_CALENDAR_MONITOR_SNAPSHOT_FILE:monitorSnapshot};
  async function runMonitor(extra={}) {
    const child=spawn(process.execPath,['scripts/google-calendar-monitor.mjs','--once'],{env:{...childEnv,...extra},stdio:['ignore','pipe','pipe']});let output='',errors='';
    child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{errors+=chunk;});
    const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Fixture monitor timed out'));},15000);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,output,errors});});});
    check(!output.includes('m'.repeat(32))&&!output.includes('s'.repeat(32))&&!errors.includes('m'.repeat(32)),'Child monitor output contains no credentials');
    const status=JSON.parse(output.trim().split('\n').at(-1));
    const persisted=JSON.parse(await readFile(monitorState));
    observations.push({code:result.code,status,monitorEvents:output.trim().split('\n').slice(0,-1).map(line=>JSON.parse(line)),pending:persisted.outbox.map(item=>({type:item.event.type,attempts:item.attempts,notBefore:item.notBefore})),alerts:monitorAlerts.map(item=>({type:item.type,reasons:item.reasons}))});
    return {...result,status};
  }
  async function startWorker() {
    worker=spawn(process.execPath,['scripts/google-calendar-worker.mjs'],{env:{PATH:process.env.PATH,APOGEE_LOCAL_PREVIEW:'1',GOOGLE_CALENDAR_INTERNAL_ORIGIN:origin,GOOGLE_CALENDAR_SYNC_SECRET:'s'.repeat(32),GOOGLE_CALENDAR_WORKER_HEALTH_FILE:join(directory,'worker-health.json'),GOOGLE_CALENDAR_ALERT_STATE_FILE:join(directory,'worker-alerts.json')},stdio:['ignore','pipe','pipe']});
    worker.stdout.on('data',chunk=>{workerOutput+=chunk;});worker.stderr.on('data',chunk=>{workerOutput+=chunk;});
    workerClosed=new Promise(resolve=>worker.on('close',resolve));
    for(let i=0;i<200;i++){const [state]=await qa`select worker_state from radar_google_calendar_queue_state`;if(state.worker_state==='ok')return;await new Promise(resolve=>setTimeout(resolve,20));}
    throw Error('Fixture worker did not report heartbeat');
  }
  async function stopWorker(){if(worker){worker.kill('SIGTERM');await workerClosed;worker=null;}}
  try {
    await startWorker();let result=await runMonitor();check(result.code===0&&result.status.status==='ok','Separate-process monitor sees real worker heartbeat');
    await stopWorker();await qa`update radar_google_calendar_queue_state set worker_seen_at=now()-interval '5 minutes'`;
    result=await runMonitor();check(result.code===1&&result.status.workerStale&&result.status.due===0,'Stopped worker is detected with empty queue');
    const incidents=monitorAlerts.length;await runMonitor();check(monitorAlerts.length===incidents,'Repeated monitor processes deduplicate same incident');
    await qa`update radar_google_calendar_queue_state set worker_seen_at=null,worker_state=null`;
    await startWorker();await stopWorker();result=await runMonitor();check(result.code===0&&monitorAlerts.at(-1).type==='recovered','Restarted worker causes one recovery notification');
    const port=server.address().port;await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
    result=await runMonitor();check(result.code===1&&result.status.endpointUnavailable,'Stopped application endpoint detected independently of worker');
    check(monitorAlerts.at(-1).type==='opened'&&monitorAlerts.at(-1).reasons.includes('endpoint_unavailable'),'Unavailable target alert reaches separate receiver');
    await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
    result=await runMonitor();check(result.code===0&&monitorAlerts.at(-1).type==='recovered','Restored endpoint reports recovery');
    setMonitorHang(true);result=await runMonitor();setMonitorHang(false);
    check(result.code===1&&result.status.endpointUnavailable,'Actual HTTP timeout creates an incident');
    result=await runMonitor();check(result.code===0&&monitorAlerts.at(-1).type==='recovered','Timeout recovery detected: '+JSON.stringify(result.status));
    await qa`insert into radar_google_calendar(user_id,refresh_token_encrypted,next_sync_at) values ('capacity-demo','SYNTHETIC_NOT_A_CREDENTIAL',now()-interval '1 second')`;
    await load('lib/opportunities/google-calendar-queue.ts').recordGoogleWorkerHeartbeat('ok');
    const beforeCalls=getApiCalls();result=await runMonitor({GOOGLE_CALENDAR_MONITOR_DRAIN_BUDGET_SECONDS:'1'});
    check(result.code===1&&result.status.capacityPressure,'Projected drain pressure alerts without relying on overdue lag');
    check(getApiCalls()===beforeCalls,'Read-only monitor never processes a queued connection or calls Google');
    await qa`delete from radar_google_calendar where user_id='capacity-demo'`;
    await runMonitor();check(monitorAlerts.at(-1).type==='recovered','Capacity pressure recovery detected');
    receiverFails=true;await qa`update radar_google_calendar_queue_state set worker_seen_at=now()-interval '5 minutes'`;
    await runMonitor();const pending=JSON.parse(await readFile(monitorState));
    check(pending.outbox.length===1,'Failed alert delivery is persisted across monitor process exit');
    pending.outbox[0].notBefore=Date.now()-1;await writeFile(monitorState,JSON.stringify(pending));receiverFails=false;
    await runMonitor();check(monitorKeys.at(-1)===pending.outbox[0].event.eventId,'Retry reuses the idempotency key');
    await load('lib/opportunities/google-calendar-queue.ts').recordGoogleWorkerHeartbeat('ok');await runMonitor();
    check(monitorAlerts.at(-1).type==='recovered','Recovery delivered after retried opening');
    check((await stat(monitorState)).mode%512===384&&(await stat(monitorSnapshot)).mode%512===384,'Monitor state and snapshot remain mode 0600');
    check(!JSON.stringify(monitorAlerts).includes('capacity-demo')&&!JSON.stringify(monitorAlerts).includes('SYNTHETIC_NOT_A_CREDENTIAL'),'Test alerts contain only aggregates');
    check(!workerOutput.includes('s'.repeat(32)),'Worker logs contain no synchronization credential');
    return {checks,scenarios,monitorNotifications:monitorAlerts.length};
  }catch(error){console.error(JSON.stringify({fixtureMonitorObservations:observations}));throw error;}
  finally{setMonitorHang(false);await stopWorker();await new Promise(resolve=>{receiver.close(resolve);receiver.closeAllConnections();});}
}
