const secret = process.env.CRON_SECRET;
const origin = process.env.RADAR_INTERNAL_ORIGIN ?? "http://web:3000";
const intervalSeconds = Number(process.env.INGESTION_INTERVAL_SECONDS ?? 300);

if (!secret) throw new Error("CRON_SECRET não configurado");
if (!Number.isInteger(intervalSeconds) || intervalSeconds < 300) {
  throw new Error("INGESTION_INTERVAL_SECONDS deve ser de pelo menos cinco minutos");
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
      status: report.failed > 0 || report.discovery?.failed ? "completed_with_warnings" : "completed",
      sourcesChecked: report.sourcesChecked,
      pagesChecked: report.pagesChecked,
      discovered: report.discovered,
      sentToReview: report.sentToReview,
      failed: report.failed,
      published: report.published,
      discoveryTargetsChecked: report.discovery?.targetsChecked ?? 0,
      discoveryNewLeads: report.discovery?.newLeads ?? 0,
      discoveryFailed: report.discovery?.failed === true,
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

while (true) {
  await run();
  await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1_000));
}
