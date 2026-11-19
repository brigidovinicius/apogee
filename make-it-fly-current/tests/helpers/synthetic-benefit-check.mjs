import { recordBenefitCheck } from "../../scripts/member-benefits-monitor.mjs";
import { setTimeout as pause } from "node:timers/promises";

export async function syntheticOfferCheck(sql, id, outcome = "verified") {
  await pause(2);
  const [row] = await sql`select public.member_benefit_monitor_revision(b) as revision from member_benefit b where b.id=${id}`;
  await recordBenefitCheck(sql, { id, revision: row.revision, checkedAt: new Date().toISOString() }, { outcome, reason: "Evidência sintética" });
}
