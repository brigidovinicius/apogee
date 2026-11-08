import "server-only";
import { requireAdmin } from "./access";
import { getSql } from "@/lib/members/db";
import { buildBehaviorInsights, type BehaviorDailyRow, type BehaviorInsights, type BehaviorSummaryRow } from "./behavior-insights";
export type { BehaviorSummaryRow } from "./behavior-insights";
type Overview = { state: "disabled" | "unavailable"; rows: BehaviorSummaryRow[] } | { state: "ready"; rows: BehaviorSummaryRow[]; insights: BehaviorInsights };
type Snapshot = { today: string; first_day: string | null; records: BehaviorDailyRow[] };
export async function getBehaviorOverview(): Promise<Overview> {
  await requireAdmin("/admin/comportamento");
  if (process.env.APOGEE_BEHAVIOR_ENABLED !== "true") return { state: "disabled", rows: [] };
  try {
    const [snapshot] = await getSql()<Snapshot[]>`with reference as (
        select (now() at time zone 'America/Sao_Paulo')::date as today
      ) select today::text,
      (select min(day)::text from apogee_behavior_daily where day <= reference.today) as first_day,
      coalesce((select jsonb_agg(jsonb_build_object('day', day::text, 'page', page, 'event', event,
        'target', target, 'device', device, 'total', count::text) order by day, page, event, target, device)
        from apogee_behavior_daily where day between reference.today - 29 and reference.today), '[]'::jsonb) as records
      from reference`;
    if (!snapshot) throw new Error("Aggregate snapshot unavailable");
    return { state: "ready", ...buildBehaviorInsights(snapshot.today, snapshot.first_day, snapshot.records) };
  } catch { return { state: "unavailable", rows: [] }; }
}
