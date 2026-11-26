import { PHOTO_ID, albumConfig, albumError, albumWorker, streamAlbumFile } from "@/lib/eventos/fotos";
import { getMemberFromHeaders } from "@/lib/members/dal";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await getMemberFromHeaders(request.headers);
  if (member?.role !== "admin") return albumError("forbidden", 403);
  const config = albumConfig();
  const { id } = await params;
  if (!config?.selfie || !PHOTO_ID.test(id)) return albumError("not_found", 404);
  try {
    return streamAlbumFile(await albumWorker(config, `/${id}/thumb`), "image/jpeg");
  } catch {
    return albumError("unavailable", 503);
  }
}
