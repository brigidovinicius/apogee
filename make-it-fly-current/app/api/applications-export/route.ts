import { handleApplicationsExportGet } from "@/lib/application-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleApplicationsExportGet(request);
}
