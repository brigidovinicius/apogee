import { manageCommunityPhotos } from "@/lib/gallery";
import { getMemberFromHeaders } from "@/lib/members/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function manageAsCurrentMember(request: Request) {
  const member = await getMemberFromHeaders(request.headers);
  return manageCommunityPhotos(request, { memberRole: member?.role });
}

export async function GET(request: Request) {
  return manageAsCurrentMember(request);
}

export async function DELETE(request: Request) {
  return manageAsCurrentMember(request);
}
