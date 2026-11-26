import { applicationOrigin } from "@/lib/members/mail";
import { RequestBodyError, UPLOAD_BODY_TIMEOUT_MS, readRequestBody } from "@/lib/request-body";
import { MAX_SELFIE_BYTES, SELFIE_CONSENT } from "@/lib/eventos/catalogo";
import { PRIVATE, actorKey, albumConfig, albumError, albumMember, albumWorker, photoLinks } from "@/lib/eventos/fotos";

const SEARCH_ERRORS = new Set(["no_face", "multiple_faces", "invalid_image", "invalid_size",
  "invalid_format", "not_indexed", "not_found", "busy", "rate_limit"]);

export async function POST(request: Request) {
  const config = albumConfig();
  if (!config) return albumError("not_found", 404);
  try {
    if (request.headers.get("origin") !== applicationOrigin()) return albumError("forbidden", 403);
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    if (request.headers.get("x-apogee-consent") !== SELFIE_CONSENT) return albumError("consent_required", 400);
    const type = request.headers.get("content-type");
    if (type !== "image/jpeg" && type !== "image/png") return albumError("invalid_format", 415);
    const body = await readRequestBody(request, MAX_SELFIE_BYTES, UPLOAD_BODY_TIMEOUT_MS);
    if (!body.length) return albumError("invalid_size", 400);

    const response = await albumWorker(config, "/search", { method: "POST", body, headers: {
      "Content-Type": type, "X-Album-Consent": SELFIE_CONSENT, "X-Album-Actor": actorKey(config, member.id),
    } });
    const result = await response.json();
    if (!response.ok) return SEARCH_ERRORS.has(result.error)
      ? albumError(result.error, response.status) : albumError("unavailable", 503);

    return Response.json({ photos: photoLinks(result.ids, config, member.id) }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return albumError(error.status === 413 ? "invalid_size" : error.status === 408 ? "upload_timeout" : "invalid_image", error.status);
    }
    return albumError("unavailable", 503);
  }
}
