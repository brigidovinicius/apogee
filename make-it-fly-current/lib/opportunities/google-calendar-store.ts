import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { googleCalendarConfig, requiredGoogleCalendarConfig, sealGoogleSecret, openGoogleSecret, GOOGLE_CALENDAR_SCOPE } from "./google-calendar-config";
import { googleTokens, GoogleCalendarError } from "./google-calendar-client";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function sameOAuthState(state: string, cookie: string) {
  return /^[a-f0-9]{64}$/.test(state) && /^[a-f0-9]{64}$/.test(cookie) &&
    timingSafeEqual(Buffer.from(state), Buffer.from(cookie));
}
export async function beginGoogleCalendarOAuth(userId: string) {
  const config = requiredGoogleCalendarConfig();
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(32).toString("base64url");
  await getSql()`insert into radar_google_calendar_oauth (user_id,state_hash,verifier_encrypted,expires_at)
    values (${userId},${hash(state)},${sealGoogleSecret(verifier,userId)},now()+interval '10 minutes')
    on conflict (user_id) do update set state_hash=excluded.state_hash,verifier_encrypted=excluded.verifier_encrypted,expires_at=excluded.expires_at`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE, access_type: "offline", prompt: "consent select_account",
    state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  }).toString();
  return { state, url: url.href };
}
export async function completeGoogleCalendarOAuth(userId: string, state: string, cookie: string, code: string) {
  if (!sameOAuthState(state,cookie) || !code || code.length > 4096) throw new GoogleCalendarError("reconnect");
  await getSql().begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'google-calendar:'+userId},0))`;
    // The lock also serializes disconnect with the token exchange.
    const [attempt] = await tx`delete from radar_google_calendar_oauth
      where user_id=${userId} and state_hash=${hash(state)} and expires_at>now() returning verifier_encrypted`;
    if (!attempt) throw new GoogleCalendarError("reconnect");
    const tokens = await googleTokens({ grant_type: "authorization_code", code,
      redirect_uri: requiredGoogleCalendarConfig().redirectUri,
      code_verifier: openGoogleSecret(String(attempt.verifier_encrypted),userId) });
    if (!tokens.refreshToken || typeof tokens.scope !== "string" || !tokens.scope.split(" ").includes(GOOGLE_CALENDAR_SCOPE)) throw new GoogleCalendarError("permission");
    await tx`insert into radar_google_calendar (user_id,refresh_token_encrypted,connected_at)
      values (${userId},${sealGoogleSecret(tokens.refreshToken,userId)},now())
      on conflict (user_id) do update set refresh_token_encrypted=excluded.refresh_token_encrypted,
      connected_at=now(),next_sync_at=now(),last_error=null,updated_at=now()`;
  });
}
export async function disconnectGoogleCalendar(userId: string) {
  await getSql().begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${'google-calendar:'+userId},0))`;
    // Serializes with an in-flight sync. Retain calendar ID so reconnect can reuse it.
    await tx`update radar_google_calendar set refresh_token_encrypted=null,updated_at=now(),last_error=null where user_id=${userId}`;
    await tx`delete from radar_google_calendar_oauth where user_id=${userId}`;
  });
  // Do not revoke the shared OAuth client: that could also disconnect Google login.
}
export async function googleCalendarStatus(userId: string) {
  if (!googleCalendarConfig()) return { configured: false, connected: false, lastSync: null, error: null };
  const [row] = await getSql()`select refresh_token_encrypted is not null as connected,last_synced_at,last_error
    from radar_google_calendar where user_id=${userId}`;
  return { configured: true, connected: !!row?.connected,
    lastSync: row?.last_synced_at ? new Date(row.last_synced_at).toISOString() : null,
    error: row?.last_error ? String(row.last_error) : null };
}
export async function queueGoogleCalendarSync(userId: string) {
  if (!googleCalendarConfig()) return false;
  const rows = await getSql()`update radar_google_calendar set next_sync_at=now() where user_id=${userId} and refresh_token_encrypted is not null returning user_id`;
  return rows.length > 0;
}
