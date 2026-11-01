import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { radarAccess } from "@/lib/billing/store";
import { applicationOrigin } from "@/lib/members/mail";
import { googleCalendarConfig, openGoogleSecret, sealGoogleSecret } from "./google-calendar-config";
import { googleApi, googleTokens, googleEventBody, googleEventId, upsertGoogleEvent, cancelGoogleEvent, GoogleCalendarError } from "./google-calendar-client";
import { listRadarOpportunities } from "./radar-client";
import { calendarEntries } from "./discovery";
import { googleQueuePolicy } from "./google-calendar-queue";
import { calendarAdultAccess } from "@/lib/members/protection";
import { googleProjectCooldown,recordGoogleFailure,recordGoogleFailureOutsideTransaction } from "./google-calendar-failures";
import {measureGoogleCalendarSync} from "./google-calendar-metrics";

export async function syncGoogleCalendar(userId: string,options:{manual?:boolean}={}): Promise<"synced" | "pending" | "disconnected" | "failed"> {
  return measureGoogleCalendarSync(()=>performGoogleCalendarSync(userId,options));
}
async function performGoogleCalendarSync(userId:string,options:{manual?:boolean}):Promise<"synced"|"pending"|"disconnected"|"failed"> {
  if (!googleCalendarConfig()) return "disconnected";
  const [connection] = await getSql()`select user_id,retry_not_before,retry_paused,last_error from radar_google_calendar where user_id=${userId} and refresh_token_encrypted is not null`;
  if (!connection) return "disconnected";
  // Access uses its own transaction; perform this before locking the connection.
  if (!(await calendarAdultAccess(userId)) || !(await radarAccess(userId,process.env.STRIPE_MODE !== "test")).active) {
    await getSql()`update radar_google_calendar set last_error='access',next_sync_at=now()+interval '15 minutes' where user_id=${userId}`;
    return "failed";
  }
  if(await googleProjectCooldown())return "pending";
  if(connection.retry_not_before && new Date(connection.retry_not_before).getTime()>Date.now())return "pending";
  if(connection.retry_paused && (!options.manual || ['permission','invalid_response'].includes(String(connection.last_error))))return "failed";
  let live;
  try { live = await listRadarOpportunities(true); } catch {
    await recordGoogleFailureOutsideTransaction(userId,new GoogleCalendarError('unavailable'));
    return "failed"; // Never interpret a catalogue outage as removal of all events.
  }
  return await getSql().begin('isolation level read committed',async tx => {
    const [row] = await tx`select * from radar_google_calendar where user_id=${userId} for update`;
    if (!row?.refresh_token_encrypted) return "disconnected" as const;
    if (!(await calendarAdultAccess(userId,tx))) {
      await tx`update radar_google_calendar set last_error='access',next_sync_at=now()+interval '15 minutes' where user_id=${userId}`;
      return "failed" as const;
    }
    if(row.retry_not_before && new Date(row.retry_not_before).getTime()>Date.now())return "pending" as const;
    if(row.retry_paused) {
      if(!options.manual || ['permission','invalid_response'].includes(String(row.last_error)))return "failed" as const;
      await tx`update radar_google_calendar set retry_paused=false,consecutive_failures=0 where user_id=${userId}`;
    }
    // Recheck after waiting for another sync's lock. Never bypass a quota hold.
    const [queue]=await tx`select cooldown_until from radar_google_calendar_queue_state where singleton=true`;
    if(queue?.cooldown_until && new Date(queue.cooldown_until).getTime()>Date.now())return "pending" as const;
    const signal = AbortSignal.timeout(40_000);
    const deadline = Date.now()+30_000;
    try {
      const tokens = await googleTokens({ grant_type: "refresh_token", refresh_token: openGoogleSecret(String(row.refresh_token_encrypted),userId) },signal);
      if (tokens.refreshToken) await tx`update radar_google_calendar set refresh_token_encrypted=${sealGoogleSecret(tokens.refreshToken,userId)} where user_id=${userId}`;
      let calendarId = row.calendar_id ? String(row.calendar_id) : null;
      if (calendarId) {
        try { await googleApi(tokens.accessToken,"/calendars/"+encodeURIComponent(calendarId),"GET",undefined,signal); }
        catch (error) {
          if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
          calendarId = null;
        }
      }
      if (!calendarId) {
        const created = await googleApi(tokens.accessToken,"/calendars","POST",{
          summary: process.env.APOGEE_LOCAL_PREVIEW === "1" ? "Apogee — TESTE LOCAL" : "Apogee — oportunidades",
          description: "Etapas das oportunidades salvas no Radar Apogee.", timeZone: "America/Sao_Paulo",
        },signal);
        if (typeof created.id !== "string" || created.id === "primary" || created.id.length < 3 || created.id.length > 1024) throw new GoogleCalendarError("invalid_response");
        calendarId = created.id;
        await tx`update radar_google_calendar set calendar_id=${calendarId} where user_id=${userId}`;
        await tx`delete from radar_google_calendar_event where user_id=${userId}`;
      }
      const saved = await tx`select opportunity_id from radar_saved_opportunity where user_id=${userId} and removed_at is null`;
      const ids = new Set(saved.map(s => String(s.opportunity_id)));
      const entries = calendarEntries(live.filter(item => ids.has(item.id)),0);
      const desired = new Map(entries.map(entry => [entry.key,googleEventBody(entry,applicationOrigin())]));
      const prior = await tx`select * from radar_google_calendar_event where user_id=${userId}`;
      const known = new Map(prior.map(event => [String(event.entry_key),event]));
      let changed = 0;
      let pending = false;
      for (const [key,body] of desired) {
        const existing = known.get(key);
        const contentHash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
        if (existing && !existing.cancelled && existing.content_hash === contentHash) continue;
        if (Date.now() > deadline || changed >= 50) { pending = true; break; }
        let revision = Number(existing?.revision ?? 0) + (existing?.cancelled ? 1 : 0);
        let eventId = googleEventId(userId,calendarId,key,revision);
        try { await upsertGoogleEvent(tokens.accessToken,calendarId,eventId,body,signal); }
        catch (error) {
          if (!(error instanceof GoogleCalendarError) || error.status !== 410) throw error;
          eventId = googleEventId(userId,calendarId,key,++revision);
          await upsertGoogleEvent(tokens.accessToken,calendarId,eventId,body,signal);
        }
        await tx`insert into radar_google_calendar_event (user_id,entry_key,event_id,revision,content_hash,cancelled)
          values (${userId},${key},${eventId},${revision},${contentHash},false)
          on conflict (user_id,entry_key) do update set event_id=excluded.event_id,revision=excluded.revision,content_hash=excluded.content_hash,cancelled=false`;
        changed++;
      }
      for (const event of prior) {
        if (event.cancelled || desired.has(String(event.entry_key))) continue;
        if (Date.now() > deadline || changed >= 50) { pending = true; break; }
        await cancelGoogleEvent(tokens.accessToken,calendarId,String(event.event_id),signal);
        await tx`update radar_google_calendar_event set cancelled=true where user_id=${userId} and entry_key=${String(event.entry_key)}`;
        changed++;
      }
      await tx`update radar_google_calendar set last_error=null,consecutive_failures=0,retry_not_before=null,retry_paused=false,updated_at=now(),
        last_synced_at=case when ${pending} then last_synced_at else now() end,
        next_sync_at=now()+case when ${pending} then interval '1 minute' else interval '15 minutes' end where user_id=${userId}`;
      return pending ? "pending" as const : "synced" as const;
    } catch (error) {
      // Commit successful API operations/maps so a retry resumes without duplicating events.
      await recordGoogleFailure(tx,userId,error);
      return "failed" as const;
    }
  });
}
export async function syncDueGoogleCalendars() {
  if (!googleCalendarConfig()) return 0;
  const policy=googleQueuePolicy();
  const deadline=Date.now()+policy.budgetMs;
  let processed=0;
  while(processed<policy.batchSize && Date.now()<deadline) {
    // Claim one due connection atomically; other workers skip it. A crashed
    // worker leaves a bounded lease, so the connection becomes eligible again.
    const [row]=await getSql()`with candidate as (
      select user_id from radar_google_calendar
      where refresh_token_encrypted is not null and next_sync_at<=now() and retry_paused=false
        and (retry_not_before is null or retry_not_before<=now())
        and not exists(select 1 from radar_google_calendar_queue_state where cooldown_until>now())
      order by next_sync_at,user_id for update skip locked limit 1
    ) update radar_google_calendar c set next_sync_at=now()+interval '3 minutes'
      from candidate where c.user_id=candidate.user_id returning c.user_id`;
    if(!row)break;
    try {await syncGoogleCalendar(String(row.user_id));}
    catch {
      await recordGoogleFailureOutsideTransaction(String(row.user_id),new GoogleCalendarError('unavailable'));
    }
    processed++;
  }
  return processed;
}
