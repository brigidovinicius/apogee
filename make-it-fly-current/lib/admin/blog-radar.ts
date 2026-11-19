import "server-only";
import { BLOG_RADAR_ARTICLES } from "@/lib/behavior-contract";
import { getSql } from "@/lib/members/db";
import { requireAdmin } from "./access";
import { shiftBehaviorDay } from "./behavior-insights";

const brasiliaDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
type ReportRange = { start: string; end: string };
type Aggregate = { target: string; first_day: string; views: string; clicks: string };
type Report =
  | { state: "disabled" | "invalid" | "unavailable"; range: ReportRange }
  | { state: "ready"; range: ReportRange; rows: { label: string; firstDay: string | null; views: number | null; clicks: number | null }[] };

export async function getBlogRadarReport(start?: string, end?: string): Promise<Report> {
  await requireAdmin("/admin/comportamento");
  const today = brasiliaDay.format(new Date());
  const range = { start: start ?? shiftBehaviorDay(today, -28), end: end ?? shiftBehaviorDay(today, -1) };
  if (process.env.APOGEE_BEHAVIOR_ENABLED !== "true") return { state: "disabled", range };

  try {
    shiftBehaviorDay(range.start, 0);
    shiftBehaviorDay(range.end, 0);
    if (range.start > range.end || range.end >= today || range.start < shiftBehaviorDay(today, -89)) return { state: "invalid", range };
  } catch { return { state: "invalid", range }; }

  try {
    const sql = getSql();
    const totals = await sql<Aggregate[]>`select target, min(day)::text as first_day,
      coalesce(sum(count) filter (where event = 'blog_radar_view' and day between ${range.start}::date and ${range.end}::date), 0)::text as views,
      coalesce(sum(count) filter (where event = 'blog_radar_click' and day between ${range.start}::date and ${range.end}::date), 0)::text as clicks
      from apogee_behavior_daily
      where page = 'blog_article' and event in ('blog_radar_view','blog_radar_click')
        and target = any(${sql.array(BLOG_RADAR_ARTICLES.map(article => article.key))}::text[])
      group by target`;
    const rows = BLOG_RADAR_ARTICLES.map(article => {
      const total = totals.find(row => row.target === article.key);
      const available = total && total.first_day <= range.end;
      return { label: article.label, firstDay: total?.first_day ?? null, views: available ? Number(total.views) : null, clicks: available ? Number(total.clicks) : null };
    });
    return { state: "ready", range, rows };
  } catch { return { state: "unavailable", range }; }
}
