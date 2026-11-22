import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { after } from "next/server";
import { legalDocumentVersions } from "@/lib/legal-documents.mjs";
import { getSql } from "@/lib/members/db";
import { publishedPrivacyVersion } from "@/lib/privacy-policy";
import { radarAmplitudeConsentVersion, type RadarAmplitudeBrowserEvent } from "./radar-amplitude-contract";

const ingestionPath = "/2/httpapi";
const batches = new Map<string, { count: number; expires: number }>();

export function radarAmplitudeConfig() {
  const apiKey = process.env.APOGEE_RADAR_AMPLITUDE_API_KEY;
  const identitySecret = process.env.APOGEE_RADAR_AMPLITUDE_IDENTITY_SECRET;
  if (process.env.APOGEE_RADAR_AMPLITUDE_ENABLED !== "true" || !apiKey || !identitySecret || identitySecret.length < 32) {
    return null;
  }
  // Local previews can only use the loopback collector.
  if (process.env.APOGEE_LOCAL_PREVIEW === "1") {
    const endpoint = process.env.APOGEE_RADAR_AMPLITUDE_TEST_ENDPOINT;
    if (!endpoint || !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}\/2\/httpapi$/.test(endpoint)) return null;
    return { apiKey, identitySecret, endpoint };
  }
  if (publishedPrivacyVersion() !== legalDocumentVersions.privacy) return null;
  if (process.env.APOGEE_RADAR_AMPLITUDE_REGION !== "EU" || process.env.APOGEE_RADAR_AMPLITUDE_TEST_ENDPOINT) return null;
  return { apiKey, identitySecret, endpoint: `https://api.eu.amplitude.com${ingestionPath}` };
}

export function radarAmplitudePrivacySignal(headers: Pick<Headers, "get">) {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}

// Undefined means ineligible. Null means eligible with no current grant.
export async function radarAmplitudePreference(memberId: string): Promise<string | null | undefined> {
  const [row] = await getSql()`select c.grant_id from "user" u
    join member_adult_review review on review.user_id=u.id and review.status='approved'
    left join radar_amplitude_consent c on c.user_id=u.id and c.policy_version=${radarAmplitudeConsentVersion}
    where u.id=${memberId} and not u.blocked and u.email_verified`;
  return row ? row.grant_id ?? null : undefined;
}

export async function setRadarAmplitudePreference(memberId: string, allow: boolean) {
  if (!allow) {
    await getSql()`delete from radar_amplitude_consent where user_id=${memberId}`;
    return null;
  }
  const [grant] = await getSql()`insert into radar_amplitude_consent (user_id, grant_id, policy_version)
    select u.id, ${randomUUID()}, ${radarAmplitudeConsentVersion} from "user" u
    join member_adult_review review on review.user_id=u.id and review.status='approved'
    where u.id=${memberId} and not u.blocked and u.email_verified
    on conflict (user_id) do update set grant_id=excluded.grant_id, policy_version=excluded.policy_version, granted_at=now()
    returning grant_id`;
  return grant?.grant_id as string | undefined;
}

export function scheduleRadarAmplitudeEvent(
  memberId: string, grant: string, event: RadarAmplitudeBrowserEvent | "radar_opportunity_saved",
) {
  const config = radarAmplitudeConfig();
  if (!config) return;
  const userId = createHmac("sha256", config.identitySecret).update("radar-amplitude:v1:").update(memberId).digest("hex");
  const time = Date.now();
  for (const [key, bucket] of batches) if (bucket.expires <= time) batches.delete(key);
  let bucket = batches.get(userId);
  if (!bucket) {
    if (batches.size >= 2048) return;
    bucket = { count: 0, expires: time + 60_000 };
    batches.set(userId, bucket);
  }
  if (bucket.count >= 60) return;
  bucket.count++;

  const insertId = randomUUID();
  after(async () => {
    try {
      // Recheck the exact grant, including a revocation followed by a new grant.
      if (await radarAmplitudePreference(memberId) !== grant) return;
      const response = await fetch(config.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          events: [{
            user_id: userId, event_type: event, time, insert_id: insertId,
          }],
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(2_000),
      });
      void response.body?.cancel().catch(() => undefined);
      if (!response.ok) console.warn("[radar-amplitude] event delivery rejected");
    } catch {
      // Product analytics is best effort. Never include the payload in logs.
      console.warn("[radar-amplitude] event delivery unavailable");
    }
  });
}
