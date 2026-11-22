import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const EVENT_ACCESS_COOKIE = "apogee-event-replay";
const maxAge = 365 * 24 * 60 * 60;

function sign(expires: string, secret: string) {
  return createHmac("sha256", secret).update(`apogee:codex-workshop-20261121:v1:${expires}`).digest("hex");
}

export function eventAccessSetCookie(secret: string) {
  const expires = String(Math.floor(Date.now() / 1000) + maxAge);
  const value = `${expires}.${sign(expires, secret)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${EVENT_ACCESS_COOKIE}=${value}; Path=/evento-openai; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function hasEventAccess(value: string | undefined, secret = process.env.BETTER_AUTH_SECRET ?? "") {
  if (secret.length < 32) return false;
  const match = value?.match(/^([1-9]\d{0,11})\.([a-f0-9]{64})$/);
  if (!match) return false;
  const [, expires, signature] = match;
  if (Number(expires) <= Math.floor(Date.now() / 1000)) return false;
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(sign(expires, secret), "hex"));
}
