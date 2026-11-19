import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import postgres from "postgres";
import { automaticTermsMatch, loadAutomaticRules, publishFromDiscovery } from "./automatic-benefit-review.mjs";
import { databaseOptions } from "./members-grant-admin.mjs";
import { sourceSession } from "./benefit-source-check.mjs";

export const indexOffers = offers => new Map(offers.map(offer => [JSON.stringify([offer.source, offer.redeem]), offer]));
export const loadBenefitOffers = async () => JSON.parse(await readFile(new URL("../content/benefit-offers.json", import.meta.url), "utf8"));
export const ruleKey = (source, redeem) => JSON.stringify([source, redeem]);

export async function recordBenefitCheck(sql, row, observation) {
  // An editorial change during the network check invalidates the observation.
  await sql`insert into member_benefit_monitor(benefit_id,receipt_revision,outcome,reason,checked_at,last_success_at)
    select b.id,${row.revision},${observation.outcome},${observation.reason},${row.checkedAt},case when ${observation.outcome}='verified' then ${row.checkedAt}::timestamptz end
    from member_benefit b where b.id=${row.id} and b.status='published' and public.member_benefit_monitor_revision(b)=${row.revision}
    on conflict (benefit_id) do update set
      receipt_revision=excluded.receipt_revision, checked_at=excluded.checked_at,
      outcome=case when member_benefit_monitor.receipt_revision=excluded.receipt_revision
        and member_benefit_monitor.outcome in ('review','unavailable')
        and excluded.outcome in ('verified','temporary') then member_benefit_monitor.outcome else excluded.outcome end,
      reason=case when member_benefit_monitor.receipt_revision=excluded.receipt_revision
        and member_benefit_monitor.outcome in ('review','unavailable')
        and excluded.outcome in ('verified','temporary') then member_benefit_monitor.reason else excluded.reason end,
      last_success_at=case when excluded.outcome='verified' and (member_benefit_monitor.receipt_revision<>excluded.receipt_revision
        or member_benefit_monitor.outcome not in ('review','unavailable')) then excluded.checked_at
        when member_benefit_monitor.receipt_revision=excluded.receipt_revision then member_benefit_monitor.last_success_at end
    where member_benefit_monitor.checked_at < excluded.checked_at`;
}

export async function checkPublishedBenefits(sql, offers, { force = false, check = sourceSession() } = {}) {
  const rules = indexOffers(offers);
  const rows = await sql`select b.id,b.evidence_url,b.redemption_url,b.name,b.description,b.partner,
    b.eligibility,b.availability,b.redemption,b.audience,b.starts_at,b.ends_at,public.member_benefit_monitor_revision(b) as revision
    from member_benefit b left join member_benefit_monitor m on m.benefit_id=b.id
    where b.status='published' and (
      ${force} or m.benefit_id is null or m.receipt_revision<>public.member_benefit_monitor_revision(b)
      or m.checked_at<=now() - interval '23 hours'
      or (m.outcome='temporary' and m.checked_at<=now() - interval '30 minutes')
    ) order by b.sort_order,b.id`;
  for (const row of rows) {
    const rule = rules.get(ruleKey(row.evidence_url, row.redemption_url));
    const checkedAt = new Date().toISOString();
    let observation = { outcome: "review", reason: "Sem regra aprovada para confirmar a fonte e o resgate" };
    if (rule) {
      observation = rule.automatic && (row.id !== rule.id || !automaticTermsMatch(row, rule))
        ? { outcome: "review", reason: "A ficha diverge dos termos da regra automática" } : await check(rule);
    }
    await recordBenefitCheck(sql, { ...row, checkedAt }, observation);
  }
  const [stats] = await sql`select count(*)::int as approved, count(*) filter(where public.member_benefit_is_available(b))::int as available,
      count(*) filter(where m.checked_at>now()-interval '24 hours' and m.receipt_revision=public.member_benefit_monitor_revision(b))::int as checked_today
    from member_benefit b left join member_benefit_monitor m on m.benefit_id=b.id where b.status='published'`;
  return { ...stats, attempted: rows.length, belowTarget: stats.available < 100 };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !["--watch", "--force"].includes(arg))) throw Error("Use --watch ou --force.");
  const rules = await loadAutomaticRules();
  const automaticOffers = rules.flatMap(rule => rule.offer ? [{ ...rule.offer, automatic: true }] : []);
  const offers = [...automaticOffers, ...await loadBenefitOffers()];
  const editorId = args.includes("--watch") ? process.env.BENEFIT_AUTO_REVIEW_EDITOR_ID : "";
  let processed = "", retryAt = 0;
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, max: 1, connect_timeout: 10 });
  try {
    do {
      try {
        console.log(JSON.stringify({ job: "benefits", ...await checkPublishedBenefits(sql, offers, { force: args.includes("--force") }) }));
      } catch {
        console.error("Falha na rodada de checagem de benefícios.");
        if (!args.includes("--watch")) process.exitCode = 1;
      }
      if (editorId) {
        try {
          const report = JSON.parse(await readFile("/app/worker-state/benefit-discovery.json", "utf8"));
          if (report.generatedAt !== processed || Date.now() >= retryAt) {
            const decisions = await publishFromDiscovery(sql, report, rules, editorId);
            processed = report.generatedAt;
            retryAt = decisions.some(decision => decision.outcome === "temporary") ? Date.now() + 60 * 60 * 1000 : Infinity;
            console.log(JSON.stringify({ job: "benefit-auto-review", discoveryAt: processed, decisions }));
          }
        } catch (error) {
          if (error.code !== "ENOENT") console.error("A revisão automática do catálogo não foi concluída.");
        }
      }
      if (args.includes("--watch")) await sleep(15 * 60 * 1000);
    } while (args.includes("--watch"));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Monitor de benefícios não inicializado."); process.exitCode = 1; });
}
