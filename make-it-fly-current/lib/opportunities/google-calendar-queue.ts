import "server-only";
import { getSql } from "@/lib/members/db";
import { googleCalendarConfig } from "./google-calendar-config";

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
  if(!configured)return {configured:false,connected:0,due:0,oldestDueAt:null,lagSeconds:0,errors:0,reconnect:0};
  const [row]=await getSql()`select
    count(*) filter (where refresh_token_encrypted is not null)::int as connected,
    count(*) filter (where refresh_token_encrypted is not null and next_sync_at<=now())::int as due,
    min(next_sync_at) filter (where refresh_token_encrypted is not null and next_sync_at<=now()) as oldest_due_at,
    count(*) filter (where refresh_token_encrypted is not null and last_error is not null)::int as errors,
    count(*) filter (where last_error='reconnect')::int as reconnect
    from radar_google_calendar`;
  const oldestDueAt=row.oldest_due_at ? new Date(row.oldest_due_at).toISOString():null;
  return {configured,connected:Number(row.connected),due:Number(row.due),oldestDueAt,
    lagSeconds:oldestDueAt?Math.max(0,Math.floor((Date.now()-Date.parse(oldestDueAt))/1000)):0,
    errors:Number(row.errors),reconnect:Number(row.reconnect)};
}
