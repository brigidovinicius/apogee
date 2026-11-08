import { handleBehaviorPost } from "@/lib/behavior";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return handleBehaviorPost(request); }
