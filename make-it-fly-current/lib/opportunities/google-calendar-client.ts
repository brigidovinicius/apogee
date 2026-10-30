import "server-only";
import { createHash } from "node:crypto";
import { requiredGoogleCalendarConfig, GOOGLE_CALENDAR_SCOPE } from "./google-calendar-config";
import { publicOpportunityPath, type CalendarEntry } from "./discovery";
import { retryAfterMilliseconds } from "./google-calendar-retry";
import {measuredGoogleFetch,recordGoogleQuotaResponse,recordGoogleEventChange} from "./google-calendar-telemetry";

export class GoogleCalendarError extends Error {
  constructor(public code: "reconnect" | "permission" | "quota" | "unavailable" | "invalid_response", public status = 0,
    public retryAfterMs=0,public quotaScope:"account"|"project"="account") {
    super(code);
  }
}
async function responseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (text.length > 1_000_000) {if(!response.ok)return {};throw new GoogleCalendarError("invalid_response");}
  try {
    const value = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid response");
    return value;
  } catch { if(!response.ok)return {};throw new GoogleCalendarError("invalid_response"); }
}
function providerError(response:Response,body:Record<string,unknown>,token=false) {
  const detail=body.error && typeof body.error==='object' ? body.error as {errors?:{reason?:string}[]}:null;
  const reasons=Array.isArray(detail?.errors)?detail.errors.map(item=>item?.reason):[];
  const quota=response.status===429 || reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','quotaExceeded','dailyLimitExceeded'].includes(r??''));
  if(quota)recordGoogleQuotaResponse();
  const scope=reasons.includes('userRateLimitExceeded')?'account':'project';
  const reconnect=token ? body.error==='invalid_grant' : response.status===401;
  const code=quota?'quota':reconnect?'reconnect':
    response.status===403?'permission':response.status>=500 || response.status===408?'unavailable':token?'unavailable':'invalid_response';
  return new GoogleCalendarError(code,response.status,retryAfterMilliseconds(response.headers.get('retry-after')),scope);
}
export async function googleTokens(parameters: Record<string, string>, signal?: AbortSignal) {
  const config = requiredGoogleCalendarConfig();
  const response = await measuredGoogleFetch("https://oauth2.googleapis.com/token", {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...parameters, client_id: config.clientId, client_secret: config.clientSecret }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  const body = await responseJson(response);
  if (!response.ok) throw providerError(response,body,true);
  if (typeof body.access_token !== "string" || !body.access_token || body.token_type !== "Bearer") throw new GoogleCalendarError("invalid_response");
  if (typeof body.scope === "string" && !body.scope.split(" ").includes(GOOGLE_CALENDAR_SCOPE)) throw new GoogleCalendarError("permission");
  return { accessToken: body.access_token, refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null, scope: body.scope };
}
export async function googleApi(accessToken: string, path: string, method = "GET", body?: unknown, signal?: AbortSignal) {
  if (!path.startsWith("/calendars") || path.includes("://")) throw new GoogleCalendarError("invalid_response");
  const response = await measuredGoogleFetch("https://www.googleapis.com/calendar/v3" + path, {
    method, redirect: "error", cache: "no-store",
    headers: { Authorization: "Bearer " + accessToken, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
  });
  const result = await responseJson(response);
  if (!response.ok) throw providerError(response,result);
  if(path.includes('/events')&&['POST','PATCH','DELETE'].includes(method))recordGoogleEventChange();
  return result;
}
export function googleEventId(userId: string, calendarId: string, key: string, revision = 0) {
  return createHash("sha256").update(JSON.stringify([userId, calendarId, key, revision])).digest("hex");
}
export function googleEventBody(entry: CalendarEntry, origin: string) {
  const { item, stage } = entry;
  const allDay = stage.start.length === 10;
  const hasDuration = !!stage.end && Date.parse(stage.end) > Date.parse(stage.start);
  const end = allDay
    ? new Date(Date.parse((stage.end ?? stage.start) + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10)
    : hasDuration ? stage.end! : new Date(Date.parse(stage.start) + 60_000).toISOString();
  return {
    summary: item.title + " — " + stage.name,
    description: "Confira as condições e eventuais alterações no Radar Apogee.\n" + new URL(publicOpportunityPath(item), origin).href +
      (!allDay && !hasDuration ? "\nDuração não informada pela fonte. Este marcador ocupa um minuto." : ""),
    start: allDay ? { date: stage.start } : { dateTime: stage.start },
    end: allDay ? { date: end } : { dateTime: end },
    status: "confirmed", transparency: "transparent",
    reminders: { useDefault: false },
    extendedProperties: { private: { apogeeRadar: "1" } },
  };
}
export async function upsertGoogleEvent(accessToken: string, calendarId: string, eventId: string, body: unknown, signal?: AbortSignal) {
  if (calendarId === "primary" || !calendarId) throw new GoogleCalendarError("invalid_response");
  const collection = "/calendars/" + encodeURIComponent(calendarId) + "/events";
  try {
    await googleApi(accessToken, collection + "/" + eventId + "?sendUpdates=none", "PATCH", body, signal);
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
    try {
      await googleApi(accessToken, collection + "?sendUpdates=none", "POST", { ...(body as object), id: eventId }, signal);
    } catch (createError) {
      if (!(createError instanceof GoogleCalendarError) || createError.status !== 409) throw createError;
      await googleApi(accessToken, collection + "/" + eventId + "?sendUpdates=none", "PATCH", body, signal);
    }
  }
}
export async function cancelGoogleEvent(accessToken: string, calendarId: string, eventId: string, signal?: AbortSignal) {
  if (calendarId === "primary" || !calendarId) throw new GoogleCalendarError("invalid_response");
  try {
    await googleApi(accessToken, "/calendars/" + encodeURIComponent(calendarId) + "/events/" + eventId + "?sendUpdates=none", "PATCH", { status: "cancelled" }, signal);
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || ![404, 410].includes(error.status)) throw error;
  }
}
