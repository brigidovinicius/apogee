import "server-only";
import type postgres from "postgres";
import {getSql} from "@/lib/members/db";
import {GoogleCalendarError} from "./google-calendar-client";
import {googleRetryPlan} from "./google-calendar-retry";

export async function recordGoogleFailure(tx:postgres.TransactionSql,userId:string,error:unknown) {
  const [row]=await tx`select consecutive_failures,refresh_token_encrypted from radar_google_calendar where user_id=${userId} for update`;
  if(!row?.refresh_token_encrypted)return;
  const failure=error instanceof GoogleCalendarError?error:new GoogleCalendarError('unavailable');
  const plan=googleRetryPlan(failure,Number(row.consecutive_failures));
  const until=new Date(Date.now()+plan.delayMs).toISOString();
  await tx`update radar_google_calendar set last_error=${failure.code},updated_at=now(),next_sync_at=${until},
    retry_not_before=${until},consecutive_failures=${plan.attempts},retry_paused=${plan.paused},
    refresh_token_encrypted=case when ${failure.code==='reconnect'} then null else refresh_token_encrypted end where user_id=${userId}`;
  // A generic/project quota is treated conservatively as a project-wide hold.
  // Explicit userRateLimitExceeded is isolated to the affected account.
  if(failure.code==='quota' && failure.quotaScope==='project')await tx`update radar_google_calendar_queue_state
    set cooldown_until=greatest(cooldown_until,${until}) where singleton=true`;
}
export async function recordGoogleFailureOutsideTransaction(userId:string,error:unknown) {
  await getSql().begin(tx=>recordGoogleFailure(tx,userId,error));
}
export async function googleProjectCooldown() {
  const [state]=await getSql()`select cooldown_until from radar_google_calendar_queue_state where singleton=true`;
  return state?.cooldown_until && new Date(state.cooldown_until).getTime()>Date.now()?new Date(state.cooldown_until):null;
}
