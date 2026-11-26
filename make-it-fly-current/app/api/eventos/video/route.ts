import { albumConfig, albumError, albumMember, albumWorker, streamAlbumFile } from "@/lib/eventos/fotos";

export async function GET(request: Request) {
  const config = albumConfig();
  if (!config) return albumError("not_found", 404);
  try {
    if (!await albumMember(request.headers, config)) return albumError("forbidden", 403);
    const response = await albumWorker(config, "/video", undefined, 10 * 60 * 1000);
    return await streamAlbumFile(response, "video/mp4", "workshop-codex-community-florianopolis.mp4");
  } catch {
    return albumError("unavailable", 503);
  }
}
