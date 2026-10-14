import { listLiveCatalogue } from "@/lib/db/live-catalogue";
import { isRadarConsumerAuthorized } from "@/lib/auth/radar-consumer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!isRadarConsumerAuthorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  try {
    return Response.json({ version: 3, generatedAt: new Date().toISOString(), opportunities: await listLiveCatalogue() }, { headers });
  } catch {
    return Response.json({ error: "Catálogo público indisponível" }, { status: 503, headers });
  }
}
