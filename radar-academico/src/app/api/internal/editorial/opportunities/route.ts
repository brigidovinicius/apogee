import { isRadarAdminConsumerAuthorized } from "@/lib/auth/radar-admin-consumer";
import { decideOpportunity, listPendingOpportunities, OpportunityReviewError } from "@/lib/official-sources/review";
import { readLimitedBody } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  }
  try {
    return Response.json({ opportunities: await listPendingOpportunities() }, { headers });
  } catch {
    return Response.json({ error: "Fila de revisão indisponível" }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  }
  let payload: unknown;
  try {
    payload = JSON.parse((await readLimitedBody(request, 4_096)).toString("utf8"));
  } catch {
    return Response.json({ error: "Solicitação inválida" }, { status: 400, headers });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ error: "Solicitação inválida" }, { status: 400, headers });
  }
  const input = payload as Record<string, unknown>;
  try {
    await decideOpportunity({ id: input.id, decision: input.decision, reviewer: input.reviewer });
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof OpportunityReviewError) {
      return Response.json({ error: error.message }, { status: 409, headers });
    }
    return Response.json({ error: "Revisão indisponível" }, { status: 503, headers });
  }
}
