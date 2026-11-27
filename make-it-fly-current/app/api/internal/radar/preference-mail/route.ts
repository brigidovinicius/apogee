import { timingSafeEqual } from "node:crypto";
import { radarPreferenceMailSecret } from "@/lib/opportunities/radar-preference-mail-config";
import { runRadarPreferenceMail } from "@/lib/opportunities/radar-preference-mail-worker";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const secret = radarPreferenceMailSecret();
  if (!secret) return new Response(null, { status: 404, headers });
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 401, headers });
  }
  try {
    const result = await runRadarPreferenceMail();
    return Response.json(result, { headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
