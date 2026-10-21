import "server-only";
import { randomUUID } from "node:crypto";
import { memberIpHeaders } from "./client-ip";

const endpoints: Record<string, string> = {
  "/api/auth/verify-email": "verify_email",
  "/api/auth/get-session": "get_session",
  "/api/auth/sign-in/email": "sign_in_email",
  "/api/auth/sign-in/username": "sign_in_username",
  "/api/auth/sign-up/email": "sign_up_email",
};
const ipHeaders = ["x-apogee-client-ip", "x-vercel-forwarded-for", "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "forwarded"];
const windowMs = 60_000;
const maxLogsPerWindow = 20;
let windowStartedAt = 0;
let attempts = 0;
let suppressed = 0;

// Called only after the existing IP guard rejects the request. Never serialize
// request values, URLs, errors or environment values (even hashed identifiers).
export function reportAuthTrustRejection(request: Request): string | null {
  try {
    const now = Date.now();
    if (now - windowStartedAt >= windowMs || now < windowStartedAt) {
      windowStartedAt = now;
      attempts = 0;
    }
    if (attempts >= maxLogsPerWindow) {
      suppressed = Math.min(suppressed + 1, Number.MAX_SAFE_INTEGER);
      return null;
    }
    attempts++;
    const trustedHeader = memberIpHeaders()[0];
    const value = trustedHeader ? request.headers.get(trustedHeader) : null;
    const provider = trustedHeader === "x-apogee-client-ip" ? "caddy"
      : trustedHeader === "x-vercel-forwarded-for" ? "vercel" : "unknown";
    const reason = !trustedHeader ? "unsupported_provider" : value === null ? "missing"
      : value === "" ? "empty" : value.includes(",") ? "ambiguous"
        : value.includes("%") ? "zone_id" : "invalid";
    const id = randomUUID();
    const path = new URL(request.url).pathname;
    console.warn(JSON.stringify({
      event: "member_auth_trust_rejected",
      version: 1,
      timestamp: new Date(now).toISOString(),
      id,
      provider,
      reason,
      method: request.method === "GET" || request.method === "POST" ? request.method : "other",
      endpoint: Object.hasOwn(endpoints, path) ? endpoints[path] : "other",
      alternateIpHeadersPresent: ipHeaders.some(header => header !== trustedHeader && request.headers.has(header)),
      suppressedSinceLastLog: suppressed,
    }));
    suppressed = 0;
    return id;
  } catch {
    // A broken sink must not change the fail-closed response or expose its error.
    return null;
  }
}
