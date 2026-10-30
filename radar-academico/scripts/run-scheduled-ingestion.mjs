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
    const discoveryBlocked = report.discovery?.targets?.filter((target) => ["blocked", "failed"].includes(target.status)).length ?? 0;
    console.log(JSON.stringify({
      component: "radar-scheduler",
      startedAt,
      status: report.failed > 0 || report.discovery?.failed || discoveryBlocked > 0 || report.leadProcessing?.failed > 0 ||
        report.leadProcessing?.blocked > 0 || report.leadProcessing?.retried > 0 ? "completed_with_warnings" : "completed",
      sourcesChecked: report.sourcesChecked,
      pagesChecked: report.pagesChecked,
      discovered: report.discovered,
      sentToReview: report.sentToReview,
      failed: report.failed,
      published: report.published,
      discoveryTargetsChecked: report.discovery?.targetsChecked ?? 0,
      discoveryNewLeads: report.discovery?.newLeads ?? 0,
      discoveryFailed: report.discovery?.failed === true,
      discoveryBlocked,
      leadsChecked: report.leadProcessing?.leadsChecked ?? 0,
      leadsCreated: report.leadProcessing?.created ?? 0,
      leadsUpdated: report.leadProcessing?.updated ?? 0,
      leadsPublished: report.leadProcessing?.published ?? 0,
      leadsBlocked: report.leadProcessing?.blocked ?? 0,
      leadsRetried: report.leadProcessing?.retried ?? 0,
      leadsIgnored: report.leadProcessing?.ignored ?? 0,
      leadsLeaseLost: report.leadProcessing?.leaseLost ?? 0,
      leadsFailed: report.leadProcessing?.failed ?? 0,
      leadReasons: report.leadProcessing?.reasons ?? {},
      alertsEnabled: report.alerts?.enabled === true,
      alertsSent: report.alerts?.sent ?? 0,
      alertsFailed: report.alerts?.failed ?? 0,
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
