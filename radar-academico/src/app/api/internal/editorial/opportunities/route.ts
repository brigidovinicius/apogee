import { isRadarAdminConsumerAuthorized } from "@/lib/auth/radar-admin-consumer";
import { listLiveCatalogue } from "@/lib/db/live-catalogue";
import { CatalogueError, manageCatalogue } from "@/lib/official-sources/catalogue-management";
import { readLimitedBody } from "@/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  try { return Response.json({ version: 3, opportunities: await listLiveCatalogue(true) }, { headers }); }
  catch { return Response.json({ error: "Catálogo indisponível" }, { status: 503, headers }); }
}
async function mutate(request: Request, method: "POST" | "PATCH" | "DELETE") {
  if (!isRadarAdminConsumerAuthorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  let payload: unknown;
  try { payload = JSON.parse((await readLimitedBody(request, 24_000)).toString("utf8")); }
  catch { return Response.json({ error: "Solicitação inválida ou muito grande" }, { status: 400, headers }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Solicitação inválida" }, { status: 400, headers });
  try { return Response.json({ ok: true, ...await manageCatalogue(method, payload as Record<string, unknown>) }, { headers }); }
  catch (error) {
    return Response.json({ error: error instanceof CatalogueError ? error.message : "Operação indisponível" }, { status: error instanceof CatalogueError ? error.status : 503, headers });
  }
}
export async function POST(request: Request) { return mutate(request, "POST"); }
export async function PATCH(request: Request) { return mutate(request, "PATCH"); }
export async function DELETE(request: Request) { return mutate(request, "DELETE"); }
