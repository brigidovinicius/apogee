import { communityPhotoImage } from "@/lib/gallery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ photo: string }> }) {
  return communityPhotoImage((await context.params).photo);
}
