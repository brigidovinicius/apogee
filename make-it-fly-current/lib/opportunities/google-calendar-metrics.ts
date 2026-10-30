import "server-only";
import {getSql} from "@/lib/members/db";
import {newGoogleTelemetry,withGoogleTelemetry} from "./google-calendar-telemetry";
import type postgres from 'postgres';

async function prune(tx:postgres.TransactionSql) {
  await tx`delete from radar_google_calendar_metric where id <= (select max(id)-10000 from radar_google_calendar_metric)`;
  await tx`delete from radar_google_calendar_metric where finished_at<now()-interval '24 hours'`;
}
export async function pruneGoogleCalendarMetrics() {
  await getSql().begin(async tx=>{await tx`select pg_advisory_xact_lock(hashtextextended('google-calendar-metrics-retention',0))`;await prune(tx);});
}

type Result='synced'|'pending'|'failed'|'disconnected';
export async function measureGoogleCalendarSync(fn:()=>Promise<Result>):Promise<Result> {
  const started=performance.now(),sample=newGoogleTelemetry();let outcome:Result|'thrown'='thrown';
  try{return await withGoogleTelemetry(sample,async()=>{const result=await fn();outcome=result;return result;});}
  finally {
    const duration=Math.min(2147483647,Math.max(0,Math.ceil(performance.now()-started)));
    try {
      await getSql().begin(async tx=>{
        await tx`select pg_advisory_xact_lock(hashtextextended('google-calendar-metrics-retention',0))`;
        await tx`insert into radar_google_calendar_metric(duration_ms,outcome,google_calls,http_errors,network_errors,quota_responses,events_changed)
          values (${duration},${outcome},${sample.googleCalls},${sample.httpErrors},${sample.networkErrors},${sample.quotaResponses},${sample.eventsChanged})`;
        // Bounded history, no account/event identifiers. Run in the same transaction.
        await prune(tx);
      });
    }catch{console.warn(JSON.stringify({component:'google-calendar-metrics',status:'write_failed'}));}
  }
}
