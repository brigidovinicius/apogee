import { PHOTO_ID, albumConfig, albumError, albumMember, albumWorker, readPhotoOptIn, streamAlbumFile, validPhotoGrant } from "@/lib/eventos/fotos";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; variant: string }> }) {
  const config = albumConfig();
  const { id, variant } = await params;
  if (!config || !PHOTO_ID.test(id) || (variant !== "thumb" && variant !== "download")) return albumError("not_found", 404);
  try {
    const member = await albumMember(request.headers, config);
    if (!member) return albumError("forbidden", 403);
    const grant = new URL(request.url).searchParams.get("grant");
    if (!config.browse && (!validPhotoGrant(config, member.id, id, grant) || !(await readPhotoOptIn(config, member.id, id))?.indexed)) {
      return albumError("not_found", 404);
    }
    const response = await albumWorker(config, `/${id}/${variant}`, undefined, variant === "download" ? 600_000 : undefined);
    return await streamAlbumFile(response, "image/jpeg", variant === "download" ? `workshop-${id}.jpg` : undefined);
  } catch {
    return albumError("unavailable", 503);
  }
}
