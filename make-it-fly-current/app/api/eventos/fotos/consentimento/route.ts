import { applicationOrigin } from "@/lib/members/mail";
import { PHOTO_OPT_IN } from "@/lib/eventos/catalogo";
import { PRIVATE, actorKey, albumConfig, albumError, albumMember, albumWorker } from "@/lib/eventos/fotos";

async function change(request: Request, method: "POST" | "DELETE") {
  const config = albumConfig();
  if (!config?.selfie) return albumError("not_found", 404);
  try {
    if (request.headers.get("origin") !== applicationOrigin()) return albumError("forbidden", 403);
    const member = await albumMember(request.headers, config, true);
    if (!member) return albumError("forbidden", 403);
    if (method === "POST" && request.headers.get("x-apogee-consent") !== PHOTO_OPT_IN) {
      return albumError("consent_required", 400);
    }
    const response = await albumWorker(config, "/consent", { method, headers: {
      "X-Album-Actor": actorKey(config, member.id), "X-Album-Consent": PHOTO_OPT_IN, "X-Album-Member": member.id,
    } });
    if (!response.ok) return response.status === 429 ? albumError("busy", 429) : albumError("unavailable", 503);
    const state = await response.json();
    return Response.json({ granted: state.granted === true, indexed: state.indexed === true }, { headers: PRIVATE });
  } catch {
    return albumError("unavailable", 503);
  }
}

export function POST(request: Request) {
  return change(request, "POST");
}

export function DELETE(request: Request) {
  return change(request, "DELETE");
}
