import { isAdmin } from "@/lib/auth/admin";
import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";
import { readLimitedBody } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  let body: string;
  try { body = (await readLimitedBody(request, 1_000_000)).toString("utf8"); }
  catch { return Response.json({ error: "CSV inválido ou excede o limite" }, { status: 413 }); }
  try {
    const rows = parseManualCsv(body);
    let saved = 0;
    for (const row of rows) {
      const result = await saveReviewItems(row.source, {
        sourceId: row.source.id, pagesChecked: 0, discovered: [row.candidate],
        ignored: 0, failed: 0, locationRejected: 0, warnings: ["Importação manual assistida"],
      });
      saved += result.saved;
    }
    return Response.json({ received: rows.length, sentToReview: saved, published: 0 });
  } catch {
    return Response.json({ error: "Não foi possível importar o CSV" }, { status: 400 });
  }
}
