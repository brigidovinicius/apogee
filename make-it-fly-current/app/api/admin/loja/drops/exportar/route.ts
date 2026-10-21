import { exportDropSignups } from "@/lib/admin/drop-signups";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return exportDropSignups(request);
}
