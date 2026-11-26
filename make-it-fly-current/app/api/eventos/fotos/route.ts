import { applicationOrigin } from "@/lib/members/mail";
import { RequestBodyError, UPLOAD_BODY_TIMEOUT_MS, readRequestBody } from "@/lib/request-body";
import { MAX_SELFIE_BYTES, SELFIE_CONSENT } from "@/lib/eventos/catalogo";
import { PRIVATE, albumConfig, albumError, albumIdentity, albumMember, albumWorker, photoLinks } from "@/lib/eventos/fotos";

const SEARCH_ERRORS = new Set(["no_face", "multiple_faces", "invalid_image", "invalid_size",
  "invalid_format", "not_enrolled", "consent_required", "not_found", "busy", "rate_limit", "search_timeout"]);

export async function GET(request: Request) {
  const config = albumConfig();
  if (!config) return albumError("not_found", 404);
  try {
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    const response = await albumWorker(config, "/saved", { headers: albumIdentity(config, member.id) });
    if (response.status === 404) return albumError("not_found", 404);
    if (!response.ok) return albumError("unavailable", 503);
    const result = await response.json();
    return Response.json({ photos: photoLinks(result.ids) }, { headers: PRIVATE });
  } catch {
    return albumError("unavailable", 503);
  }
}

export async function POST(request: Request) {
  const config = albumConfig();
  if (!config?.selfie) return albumError("not_found", 404);
  try {
    if (request.headers.get("origin") !== applicationOrigin()) return albumError("forbidden", 403);
    const member = await albumMember(request.headers, config, true);
    if (!member) return albumError("forbidden", 403);
    if (request.headers.get("x-apogee-consent") !== SELFIE_CONSENT) return albumError("consent_required", 400);
    const type = request.headers.get("content-type");
    if (type !== "image/jpeg" && type !== "image/png") return albumError("invalid_format", 415);
    const validateOnly = new URL(request.url).searchParams.get("modo") === "validar";
    const body = await readRequestBody(request, MAX_SELFIE_BYTES, UPLOAD_BODY_TIMEOUT_MS);
    if (!body.length) return albumError("invalid_size", 400);

    let response: Response;
    try {
      response = await albumWorker(config, validateOnly ? "/validate" : "/search", { method: "POST", body, headers: {
        ...albumIdentity(config, member.id), "Content-Type": type, "X-Album-Consent": SELFIE_CONSENT,
      } }, 95_000);
    } finally {
      body.fill(0);
    }
    const result = await response.json();
    if (!response.ok) return SEARCH_ERRORS.has(result.error)
      ? albumError(result.error, response.status) : albumError("unavailable", 503);

    if (validateOnly) return result.validated === true
      ? Response.json({ validated: true }, { headers: PRIVATE }) : albumError("unavailable", 503);
    return Response.json({ photos: photoLinks(result.ids) }, { headers: PRIVATE });
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return albumError(error.status === 413 ? "invalid_size" : error.status === 408 ? "upload_timeout" : "invalid_image", error.status);
    }
    return albumError("unavailable", 503);
  }
}
