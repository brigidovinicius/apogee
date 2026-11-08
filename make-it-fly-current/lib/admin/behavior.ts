import "server-only";
import { requireAdmin } from "./access";
import { getSql } from "@/lib/members/db";
export type BehaviorSummaryRow = { page: string; event: string; target: string; device: string; total: string };
export async function getBehaviorOverview(): Promise<{ state: "disabled" | "unavailable" | "ready"; rows: BehaviorSummaryRow[] }> {
  await requireAdmin("/admin/comportamento");
  if (process.env.APOGEE_BEHAVIOR_ENABLED !== "true") return { state: "disabled", rows: [] };
  try {
    const rows = await getSql()<BehaviorSummaryRow[]>`select page, event, target, device, sum(count)::text as total
      from apogee_behavior_daily where day >= (now() at time zone 'America/Sao_Paulo')::date - 29
      group by page, event, target, device order by sum(count) desc, page, event, target, device`;
    return { state: "ready", rows: [...rows] };
  } catch { return { state: "unavailable", rows: [] }; }
}
