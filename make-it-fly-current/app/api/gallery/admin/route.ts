import { manageCommunityPhotos } from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return manageCommunityPhotos(request);
}

export async function DELETE(request: Request) {
  return manageCommunityPhotos(request);
}
