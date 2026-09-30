import { listCommunityPhotos, uploadCommunityPhoto } from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return listCommunityPhotos(request);
}

export async function POST(request: Request) {
  return uploadCommunityPhoto(request);
}
