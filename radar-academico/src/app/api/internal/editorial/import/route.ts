import { isRadarAdminConsumerAuthorized } from "@/lib/auth/radar-admin-consumer";
import { withAdminTransaction } from "@/lib/db/client";
import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";
import { readLimitedBody } from "@/lib/security";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isRadarAdminConsumerAuthorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers });
  }
  let csv: string;
  try {
    csv = (await readLimitedBody(request, 20_000)).toString("utf8");
  } catch {
    return Response.json({ error: "Arquivo excede o limite" }, { status: 413, headers });
  }
  try {
    const rows = parseManualCsv(csv);
    if (rows.length < 1 || rows.length > 10) {
      return Response.json({ error: "Envie de 1 a 10 oportunidades" }, { status: 400, headers });
    }
    const ids = [...new Set(rows.map((row) => row.source.id))];
    if (ids.length !== 1) {
      return Response.json({ error: "Envie uma fonte por importação" }, { status: 400, headers });
    }
    const active = await withAdminTransaction(async (client) => (
      await client.query<{ id: string }>(
        "select id from official_sources where id=any($1::text[]) and active=true and verification_status='verified'",
        [ids],
      )
    ).rows.map((row) => row.id));
    if (active.length !== ids.length) {
      return Response.json({ error: "Audite e ative todas as fontes antes de importar" }, { status: 409, headers });
    }
    const result = await saveReviewItems(rows[0].source, {
      sourceId: rows[0].source.id, pagesChecked: 0,
      discovered: rows.map((row) => row.candidate),
      ignored: 0, failed: 0, locationRejected: 0, warnings: ["Importação manual assistida"],
    });
    return Response.json({ received: rows.length, saved: result.saved, blocked: result.blocked, published: result.published }, { headers });
  } catch {
    return Response.json({ error: "Importação não concluída; revise os dados oficiais" }, { status: 400, headers });
  }
}
