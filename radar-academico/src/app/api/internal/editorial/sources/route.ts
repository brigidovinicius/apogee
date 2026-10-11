import { isRadarAdminConsumerAuthorized } from "@/lib/auth/radar-admin-consumer";
import {
  EditorialInputError,
  listEditorialSources,
  runEditorialSourceIngestion,
  setEditorialSourceActive,
  verifyEditorialSource,
} from "@/lib/official-sources/editorial";
import { readLimitedBody } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function unauthorized() {
  return Response.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
}

function invalidRequest() {
  return Response.json({ error: "Solicitação editorial inválida" }, { status: 400, headers: NO_STORE });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function payloadFor(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const bytes = await readLimitedBody(request, 4_096);
    const payload: unknown = JSON.parse(bytes.toString("utf8"));
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) return unauthorized();

  try {
    return Response.json({ sources: await listEditorialSources() }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: "Auditoria editorial indisponível" }, { status: 503, headers: NO_STORE });
  }
}

export async function POST(request: Request) {
  // Authenticate before consuming the body so an unauthenticated caller never
  // reaches the database or makes the service buffer an arbitrary payload.
  if (!isRadarAdminConsumerAuthorized(request)) return unauthorized();

  const payload = await payloadFor(request);
  if (!payload || typeof payload.action !== "string") return invalidRequest();

  try {
    if (payload.action === "verify") {
      await verifyEditorialSource({
        sourceId: payload.sourceId,
        officialSource: payload.officialSource,
        locationConfirmed: payload.locationConfirmed,
        collectionAllowed: payload.collectionAllowed,
      });
      return Response.json({ ok: true, action: "verify" }, { headers: NO_STORE });
    }

    if (payload.action === "set-active") {
      await setEditorialSourceActive({ sourceId: payload.sourceId, active: payload.active });
      return Response.json({ ok: true, action: "set-active" }, { headers: NO_STORE });
    }

    if (payload.action === "ingest") {
      const report = await runEditorialSourceIngestion({
        sourceId: payload.sourceId,
        maxPages: payload.maxPages,
        maxCandidates: payload.maxCandidates,
      });
      return Response.json({ ok: true, action: "ingest", report }, { headers: NO_STORE });
    }
  } catch (error) {
    if (error instanceof EditorialInputError) return invalidRequest();
    return Response.json({ error: "Operação editorial não foi concluída" }, { status: 409, headers: NO_STORE });
  }

  return invalidRequest();
}
