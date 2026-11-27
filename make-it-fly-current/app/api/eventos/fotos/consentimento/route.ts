import { applicationOrigin } from "@/lib/members/mail";
import { PHOTO_OPT_IN } from "@/lib/eventos/catalogo";
import { PRIVATE, albumConfig, albumError, albumIdentity, albumMember, albumWorker } from "@/lib/eventos/fotos";

async function change(request: Request, method: "GET" | "POST" | "DELETE") {
  const config = albumConfig();
  if (!config?.selfie) return albumError("not_found", 404);
  try {
    if (method !== "GET" && request.headers.get("origin") !== applicationOrigin()) return albumError("forbidden", 403);
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    if (method === "POST" && request.headers.get("x-apogee-consent") !== PHOTO_OPT_IN) {
      return albumError("consent_required", 400);
    }
    const response = await albumWorker(config, "/consent", { method, headers: {
      ...albumIdentity(config, member.id), "X-Album-Consent": PHOTO_OPT_IN,
    } });
    if (!response.ok) {
      if (response.status === 429) return albumError("busy", 429);
      if (response.status === 404) return albumError("not_found", 404);
      return albumError("unavailable", 503);
    }
    const state = await response.json();
    return Response.json({ granted: state.granted === true, indexed: state.indexed === true }, { headers: PRIVATE });
  } catch {
    return albumError("unavailable", 503);
  }
}

export function GET(request: Request) {
  return change(request, "GET");
}

export function POST(request: Request) {
  return change(request, "POST");
}

export function DELETE(request: Request) {
  return change(request, "DELETE");
}
