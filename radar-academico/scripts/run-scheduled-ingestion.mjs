const secret = process.env.CRON_SECRET;
const origin = process.env.RADAR_INTERNAL_ORIGIN ?? "http://web:3000";
const intervalSeconds = Number(process.env.INGESTION_INTERVAL_SECONDS ?? 86_400);

if (!secret) throw new Error("CRON_SECRET não configurado");
if (!Number.isFinite(intervalSeconds) || intervalSeconds < 3_600) {
  throw new Error("INGESTION_INTERVAL_SECONDS deve ser de pelo menos uma hora");
}

async function run() {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(`${origin}/api/cron/ingest-official-sources`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const report = await response.json();
    console.log(JSON.stringify({
      component: "radar-scheduler",
      startedAt,
      status: "completed",
      pagesChecked: report.pagesChecked,
      discovered: report.discovered,
      sentToReview: report.sentToReview,
      published: report.published,
    }));
  } catch (error) {
    console.error(JSON.stringify({
      component: "radar-scheduler",
      startedAt,
      status: "failed",
      message: error instanceof Error ? error.message : "erro desconhecido",
    }));
  }
}

await run();
setInterval(run, intervalSeconds * 1_000);
