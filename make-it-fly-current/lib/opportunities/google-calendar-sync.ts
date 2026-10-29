import "server-only";
import { createHash } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { radarAccess } from "@/lib/billing/store";
import { applicationOrigin } from "@/lib/members/mail";
import { googleCalendarConfig, openGoogleSecret, sealGoogleSecret } from "./google-calendar-config";
import { googleApi, googleTokens, googleEventBody, googleEventId, upsertGoogleEvent, cancelGoogleEvent, GoogleCalendarError } from "./google-calendar-client";
import { listRadarOpportunities } from "./radar-client";
import { calendarEntries } from "./discovery";

export async function syncGoogleCalendar(userId: string): Promise<"synced" | "pending" | "disconnected" | "failed"> {
  if (!googleCalendarConfig()) return "disconnected";
  const [connection] = await getSql()`select user_id from radar_google_calendar where user_id=${userId} and refresh_token_encrypted is not null`;
  if (!connection) return "disconnected";
  // Access uses its own transaction; perform this before locking the connection.
  if (!(await radarAccess(userId,process.env.STRIPE_MODE !== "test")).active) {
    await getSql()`update radar_google_calendar set last_error='access',next_sync_at=now()+interval '15 minutes' where user_id=${userId}`;
    return "failed";
  }
  let live;
  try { live = await listRadarOpportunities(true); } catch {
    await getSql()`update radar_google_calendar set last_error='unavailable',next_sync_at=now()+interval '5 minutes' where user_id=${userId}`;
    return "failed"; // Never interpret a catalogue outage as removal of all events.
  }
  return await getSql().begin(async tx => {
    const [row] = await tx`select * from radar_google_calendar where user_id=${userId} for update`;
    if (!row?.refresh_token_encrypted) return "disconnected" as const;
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
      await tx`update radar_google_calendar set last_error=null,updated_at=now(),
        last_synced_at=case when ${pending} then last_synced_at else now() end,
        next_sync_at=now()+case when ${pending} then interval '1 minute' else interval '15 minutes' end where user_id=${userId}`;
      return pending ? "pending" as const : "synced" as const;
    } catch (error) {
      const code = error instanceof GoogleCalendarError ? error.code : "unavailable";
      // Commit successful API operations/maps so a retry resumes without duplicating events.
      await tx`update radar_google_calendar set last_error=${code},updated_at=now(),next_sync_at=now()+interval '5 minutes',
        refresh_token_encrypted=case when ${code === "reconnect"} then null else refresh_token_encrypted end where user_id=${userId}`;
      return "failed" as const;
    }
  });
}
export async function syncDueGoogleCalendars() {
  if (!googleCalendarConfig()) return 0;
  const rows = await getSql()`select user_id from radar_google_calendar where refresh_token_encrypted is not null and next_sync_at<=now() order by next_sync_at limit 3`;
  for (const row of rows) await syncGoogleCalendar(String(row.user_id));
  return rows.length;
}
