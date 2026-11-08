import { handleJourneyPost } from "@/lib/journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handleJourneyPost();
}
