import "server-only";
import {getSql} from "@/lib/members/db";

export function googleMetricsPolicy() {
  const read=(name:string,fallback:number,min:number,max:number)=>{
    const value=Number(process.env[name]??fallback);
    if(!Number.isInteger(value)||value<min||value>max)throw Error('Invalid calendar metrics configuration');return value;
  };
  return {windowMinutes:read('GOOGLE_CALENDAR_METRICS_WINDOW_MINUTES',15,1,1440),minimumSamples:read('GOOGLE_CALENDAR_METRICS_MIN_SAMPLES',20,5,1000),
    workerMaxAgeSeconds:read('GOOGLE_CALENDAR_WORKER_MAX_AGE_SECONDS',240,180,3600)};
}
export async function googleCapacitySnapshot(queue:{ready:number;errors:number;reconnect:number;paused:number;cooldownUntil:string|null},batchSize:number) {
  const policy=googleMetricsPolicy();
  const [row]=await getSql()`select count(*)::int as attempts,
    count(*) filter(where google_calls>0)::int as provider_attempts,
    count(*) filter(where google_calls>0 and outcome='synced')::int as synced,
    count(*) filter(where google_calls>0 and outcome='pending')::int as partial,
    count(*) filter(where outcome in ('failed','thrown'))::int as failed,
    avg(duration_ms) filter(where google_calls>0) as mean_ms,
    percentile_cont(0.95) within group(order by duration_ms) filter(where google_calls>0) as p95_ms,
    coalesce(sum(google_calls),0) as google_calls,coalesce(sum(http_errors),0) as http_errors,
    coalesce(sum(network_errors),0) as network_errors,coalesce(sum(quota_responses),0) as quota_responses,
    coalesce(sum(events_changed),0) as events_changed
    from radar_google_calendar_metric where finished_at>=now()-${policy.windowMinutes}*interval '1 minute' and finished_at<=clock_timestamp()`;
  const n=(key:string)=>Number(row?.[key]??0),providerAttempts=n('provider_attempts'),synced=n('synced');
  const p95Ms=row?.p95_ms==null?null:Math.ceil(Number(row.p95_ms));
  const blocked=!!(queue.errors||queue.reconnect||queue.paused||queue.cooldownUntil||n('failed')||n('partial')||n('quota_responses'));
  const estimateAvailable=providerAttempts>=policy.minimumSamples&&p95Ms!==null&&p95Ms>0&&!blocked;
  // One serial worker, measured workload mix, plus the one-second inter-batch gap.
  const perAccountMs=p95Ms===null?null:p95Ms+1000/batchSize;
  return {windowMinutes:policy.windowMinutes,minimumSamples:policy.minimumSamples,attempts:n('attempts'),providerAttempts,
    synced,partial:n('partial'),failed:n('failed'),meanDurationMs:row?.mean_ms==null?null:Math.round(Number(row.mean_ms)),p95DurationMs:p95Ms,
    successRate:providerAttempts?synced/providerAttempts:null,observedSyncedPerMinute:synced/policy.windowMinutes,
    googleCalls:n('google_calls'),httpErrors:n('http_errors'),networkErrors:n('network_errors'),quotaResponses:n('quota_responses'),eventsChanged:n('events_changed'),
    estimateAvailable,estimateReason:estimateAvailable?'observed_workload':blocked?'blocked_or_failed':'insufficient_samples',
    estimatedDrainSeconds:estimateAvailable?Math.ceil(queue.ready*perAccountMs!/1000):null,
    estimatedFullSyncsPer15Minutes:estimateAvailable?Math.floor(900000/perAccountMs!):null};
}
