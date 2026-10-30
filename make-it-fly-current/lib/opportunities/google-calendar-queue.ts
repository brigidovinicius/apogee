import "server-only";
import { getSql } from "@/lib/members/db";
import { googleCalendarConfig } from "./google-calendar-config";
import {googleCapacitySnapshot,googleMetricsPolicy} from "./google-calendar-capacity";
import {pruneGoogleCalendarMetrics} from "./google-calendar-metrics";

export async function recordGoogleWorkerHeartbeat(state:'running'|'ok'|'failed') {
  if(state==='ok')await pruneGoogleCalendarMetrics();
  await getSql()`update radar_google_calendar_queue_state set worker_seen_at=clock_timestamp(),worker_state=${state} where singleton=true`;
}

function integer(name: string, fallback: number, max: number) {
  const value=Number(process.env[name] ?? fallback);
  if(!Number.isInteger(value) || value<1 || value>max) throw Error("Invalid Google Calendar queue configuration");
  return value;
}
export function googleQueuePolicy() {
  return {batchSize:integer("GOOGLE_CALENDAR_SYNC_BATCH_SIZE",3,20),budgetMs:integer("GOOGLE_CALENDAR_SYNC_BUDGET_SECONDS",90,120)*1000,
    maxLagSeconds:integer("GOOGLE_CALENDAR_SYNC_MAX_LAG_SECONDS",900,86400)};
}
export async function googleQueueStatus() {
  const configured=!!googleCalendarConfig();
  if(!configured)return {configured:false,connected:0,due:0,ready:0,oldestDueAt:null,lagSeconds:0,errors:0,reconnect:0,quota:0,paused:0,retrying:0,cooldownUntil:null,workerHeartbeatAt:null,workerHealthy:false,capacity:null};
  const [row]=await getSql()`select
    count(*) filter (where refresh_token_encrypted is not null)::int as connected,
    count(*) filter (where refresh_token_encrypted is not null and next_sync_at<=now())::int as due,
    count(*) filter (where refresh_token_encrypted is not null and next_sync_at<=now() and not retry_paused and (retry_not_before is null or retry_not_before<=now()))::int as ready,
    min(next_sync_at) filter (where refresh_token_encrypted is not null and next_sync_at<=now()) as oldest_due_at,
    count(*) filter (where refresh_token_encrypted is not null and last_error is not null)::int as errors,
    count(*) filter (where last_error='reconnect')::int as reconnect,
    count(*) filter (where refresh_token_encrypted is not null and last_error='quota')::int as quota,
    count(*) filter (where refresh_token_encrypted is not null and retry_paused)::int as paused,
    count(*) filter (where refresh_token_encrypted is not null and retry_not_before>now() and not retry_paused)::int as retrying
    from radar_google_calendar`;
  const [state]=await getSql()`select cooldown_until,worker_seen_at,worker_state from radar_google_calendar_queue_state where singleton=true`;
  const oldestDueAt=row.oldest_due_at ? new Date(row.oldest_due_at).toISOString():null;
  const cooldownUntil=state?.cooldown_until&&new Date(state.cooldown_until).getTime()>Date.now()?new Date(state.cooldown_until).toISOString():null;
  const workerHeartbeatAt=state?.worker_seen_at?new Date(state.worker_seen_at).toISOString():null;
  const age=workerHeartbeatAt?Date.now()-Date.parse(workerHeartbeatAt):null;
  const queue={configured,connected:Number(row.connected),due:Number(row.due),ready:cooldownUntil?0:Number(row.ready??0),oldestDueAt,
    lagSeconds:oldestDueAt?Math.max(0,Math.floor((Date.now()-Date.parse(oldestDueAt))/1000)):0,
    errors:Number(row.errors),reconnect:Number(row.reconnect),quota:Number(row.quota??0),paused:Number(row.paused??0),retrying:Number(row.retrying??0),
    cooldownUntil,workerHeartbeatAt,workerHealthy:age!==null&&age>=0&&age<=googleMetricsPolicy().workerMaxAgeSeconds*1000&&state?.worker_state!=='failed'};
  return {...queue,capacity:await googleCapacitySnapshot(queue,googleQueuePolicy().batchSize)};
}
