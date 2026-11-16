import { isRadarAdminConsumerAuthorized } from "@/lib/auth/radar-admin-consumer";
import { withAdminTransaction } from "@/lib/db/client";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  try {
    const status = await withAdminTransaction(async client => (await client.query("select radar_ai.status() as status")).rows[0].status);
    return Response.json({ status }, { headers });
  } catch { return Response.json({ error: "Controle de orçamento indisponível" }, { status: 503, headers }); }
}
