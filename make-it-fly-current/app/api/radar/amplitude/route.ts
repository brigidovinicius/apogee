import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import {
  radarAmplitudeConfig, radarAmplitudePreference, radarAmplitudePrivacySignal,
  scheduleRadarAmplitudeEvent, setRadarAmplitudePreference,
} from "@/lib/radar-amplitude";
import { isRadarAmplitudeBrowserEvent, isRadarAmplitudeGrant, radarAmplitudeConsentVersion } from "@/lib/radar-amplitude-contract";
import { readRequestBody, RequestBodyError } from "@/lib/request-body";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const emptyResponse = (status: number) => new Response(null, { status, headers });

export async function POST(request: Request) {
  if (!radarAmplitudeConfig()) return emptyResponse(404);
  try {
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") {
      return emptyResponse(403);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return emptyResponse(415);
    }
    const parsed: unknown = JSON.parse((await readRequestBody(request, 512)).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return emptyResponse(400);
    const data = parsed as Record<string, unknown>;
    const fields = Object.keys(data).length;
    const choice = (fields === 1 && data.choice === "deny")
      || (fields === 2 && data.choice === "allow" && data.version === radarAmplitudeConsentVersion);
    const track = fields === 2 && isRadarAmplitudeBrowserEvent(data.event) && isRadarAmplitudeGrant(data.grant);
    if (!choice && !track) return emptyResponse(400);
    if (data.choice !== "deny" && radarAmplitudePrivacySignal(request.headers)) return emptyResponse(403);

    const member = await getMemberFromHeaders(request.headers);
    if (!member) return emptyResponse(403);
    if (choice) {
      const grant = await setRadarAmplitudePreference(member.id, data.choice === "allow");
      if (grant === undefined) return emptyResponse(403);
      return Response.json({ grant }, { headers });
    }

    const grant = await radarAmplitudePreference(member.id);
    if (!grant || grant !== data.grant || !isRadarAmplitudeBrowserEvent(data.event)) return emptyResponse(403);
    scheduleRadarAmplitudeEvent(member.id, grant, data.event);
    return emptyResponse(204);
  } catch (error) {
    const status = error instanceof RequestBodyError ? error.status : error instanceof SyntaxError ? 400 : 503;
    return emptyResponse(status);
  }
}
