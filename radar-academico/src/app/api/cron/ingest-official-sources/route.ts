import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { loadOfficialSource } from "@/lib/ingestion/official-source-registry";
import { secretMatches } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret");
  if (!secretMatches(supplied, expected)) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const search = new URL(request.url).searchParams;
  const sourceId = search.get("sourceId");
  const maxPages = Number(search.get("maxPages") ?? "1");
  const maxCandidates = Number(search.get("maxCandidates") ?? "10");
  if (!sourceId || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(sourceId) || !(await loadOfficialSource(sourceId)) ||
    !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10 ||
    !Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 10) {
    return Response.json({ error: "Parâmetros de ingestão inválidos" }, { status: 400 });
  }

  try {
    const report = await runOfficialSourceIngestion({ sourceId, maxPages, maxCandidates });
    return Response.json(report);
  } catch {
    return Response.json({ error: "Falha na ingestão" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, protected: true, automaticPublish: false });
}
