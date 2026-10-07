import { isAdmin } from "@/lib/auth/admin";
import { parseManualCsv } from "@/lib/ingestion/import-csv";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const body = await request.text();
  if (Buffer.byteLength(body) > 1_000_000) return Response.json({ error: "CSV excede 1 MB" }, { status: 413 });
  try {
    const rows = parseManualCsv(body);
    let saved = 0;
    for (const row of rows) {
      const result = await saveReviewItems(row.source, {
        sourceId: row.source.id, pagesChecked: 0, discovered: [row.candidate],
        ignored: 0, failed: 0, warnings: ["Importação manual assistida"],
      });
      saved += result.saved;
    }
    return Response.json({ received: rows.length, sentToReview: saved, published: 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "CSV inválido" }, { status: 400 });
  }
}