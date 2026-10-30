import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { applicationOrigin } from "@/lib/members/mail";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const GOOGLE_CALENDAR_CALLBACK = "/api/integracoes/google-agenda/callback";
export const GOOGLE_CALENDAR_COOKIE = "apogee_google_calendar_state";
export const GOOGLE_CALENDAR_PATH = "/membros/meu-calendario";

export function googleCalendarConfig() {
  if (process.env.RADAR_GOOGLE_CALENDAR_ENABLED !== "true" || process.env.RADAR_CALENDAR_PERSONAL_ENABLED !== "true") return null;
  if (!!process.env.GOOGLE_CALENDAR_CLIENT_ID !== !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET) return null;
  // Dedicated overrides can share the existing login client without changing its scopes.
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const key = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY;
  if (!clientId || !clientSecret || !key || !/^[a-f0-9]{64}$/i.test(key)) return null;
  return { clientId, clientSecret, key: Buffer.from(key, "hex"), redirectUri: new URL(GOOGLE_CALENDAR_CALLBACK, applicationOrigin()).href };
}
export function requiredGoogleCalendarConfig() {
  const config = googleCalendarConfig();
  if (!config) throw new Error("Google Calendar is not configured");
  return config;
}
export function sealGoogleSecret(value: string, userId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", requiredGoogleCalendarConfig().key, iv);
  cipher.setAAD(Buffer.from(userId));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}
export function openGoogleSecret(value: string, userId: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted credential");
  const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid encrypted credential");
  const decipher = createDecipheriv("aes-256-gcm", requiredGoogleCalendarConfig().key, iv);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
