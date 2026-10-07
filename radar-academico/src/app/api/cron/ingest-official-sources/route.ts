import { runOfficialSourceIngestion } from "@/lib/ingestion";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret");
  if (!expected || supplied !== expected) return Response.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const report = await runOfficialSourceIngestion();
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha na ingestão" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, protected: true, automaticPublish: false });
}