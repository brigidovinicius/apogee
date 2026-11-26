import { PHOTO_ID, albumConfig, albumError, albumMember, albumIdentity, albumWorker, streamAlbumFile } from "@/lib/eventos/fotos";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
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
