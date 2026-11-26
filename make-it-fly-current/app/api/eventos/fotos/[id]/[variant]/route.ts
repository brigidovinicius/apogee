import { applicationOrigin } from "@/lib/members/mail";
import { PRIVATE, PHOTO_ID, albumConfig, albumError, albumMember, albumIdentity, albumWorker, streamAlbumFile } from "@/lib/eventos/fotos";

type PhotoRoute = { params: Promise<{ id: string; variant: string }> };

export async function GET(request: Request, { params }: PhotoRoute) {
  const config = albumConfig();
  const { id, variant } = await params;
  if (!config || !PHOTO_ID.test(id) || (variant !== "thumb" && variant !== "download")) return albumError("not_found", 404);
  try {
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    if (!config.browse) {
      const saved = await albumWorker(config, `/saved/${id}`, { headers: albumIdentity(config, member.id) });
      if (saved.status === 404) return albumError("not_found", 404);
      if (!saved.ok) return albumError("unavailable", 503);
      const { ids } = await saved.json();
      if (!Array.isArray(ids) || !ids.includes(id)) return albumError("not_found", 404);
    }
    const response = await albumWorker(config, `/${id}/${variant}`, undefined, variant === "download" ? 600_000 : undefined);
    return await streamAlbumFile(response, "image/jpeg", variant === "download" ? `workshop-${id}.jpg` : undefined);
  } catch {
    return albumError("unavailable", 503);
  }
}

async function changeSavedPhoto(request: Request, { params }: PhotoRoute, method: "PUT" | "DELETE") {
  const config = albumConfig();
  const { id, variant } = await params;
  if (!config || variant !== "salvar" || !PHOTO_ID.test(id) || (method === "PUT" && !config.browse)) {
    return albumError("not_found", 404);
  }
  try {
    if (request.headers.get("origin") !== applicationOrigin()) return albumError("forbidden", 403);
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    const response = await albumWorker(config, `/saved/${id}`, { method, headers: albumIdentity(config, member.id) });
    if (response.status === 404) return albumError("not_found", 404);
    if (!response.ok) return albumError("unavailable", 503);
    return Response.json({ saved: method === "PUT" }, { headers: PRIVATE });
  } catch {
    return albumError("unavailable", 503);
  }
}

export function PUT(request: Request, context: PhotoRoute) {
  return changeSavedPhoto(request, context, "PUT");
}

export function DELETE(request: Request, context: PhotoRoute) {
  return changeSavedPhoto(request, context, "DELETE");
}
