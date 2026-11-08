export const BEHAVIOR_METRICS = [
  { key: "views", event: "page_view", label: "Visualizações" },
  { key: "navigation", event: "navigation", label: "Navegações" },
  { key: "actions", event: "action", label: "Ações iniciadas" },
  { key: "filters", event: "filter_apply", label: "Uso dos filtros" },
] as const;
export type BehaviorMetric = typeof BEHAVIOR_METRICS[number]["key"];
export type BehaviorCounts = Record<BehaviorMetric, number>;
export type BehaviorSummaryRow = { page: string; event: string; target: string; device: string; total: string };
export type BehaviorDailyRow = BehaviorSummaryRow & { day: string };
export type BehaviorDay = { day: string; available: boolean; today: boolean; counts: BehaviorCounts };
export type BehaviorWeek = { start: string; end: string; availableDays: number; complete: boolean; counts: BehaviorCounts };
export type BehaviorVariation = { current: number | null; previous: number | null; difference: number | null; percent: number | null; reason: "history" | "zero-base" | "no-events" | null };
export type BehaviorInsights = {
  today: string;
  firstDay: string | null;
  daily: BehaviorDay[];
  totals: BehaviorCounts;
  currentWeek: BehaviorWeek;
  previousWeek: BehaviorWeek;
  variations: Record<BehaviorMetric, BehaviorVariation>;
};

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Invalid aggregate date");
  const date = new Date(`${day}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error("Invalid aggregate date");
  return date;
}
export function shiftBehaviorDay(day: string, offset: number) {
  const date = validDay(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
const emptyCounts = (): BehaviorCounts => ({ views: 0, navigation: 0, actions: 0, filters: 0 });
function add(a: number, b: number) {
  const value = a + b;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid aggregate count");
  return value;
}

// Pure calendar arithmetic over existing daily counters. No identities or new events.
export function buildBehaviorInsights(today: string, firstDay: string | null, records: BehaviorDailyRow[]) {
  validDay(today);
  if (firstDay !== null) { validDay(firstDay); if (firstDay > today) throw new Error("Invalid history range"); }
  const start = shiftBehaviorDay(today, -29);
  const daily: BehaviorDay[] = Array.from({ length: 30 }, (_, index) => {
    const day = shiftBehaviorDay(start, index);
    return { day, available: firstDay !== null && day >= firstDay, today: day === today, counts: emptyCounts() };
  });
  const byDay = new Map(daily.map(day => [day.day, day]));
  const summary = new Map<string, BehaviorSummaryRow>();
  const totals = emptyCounts();
  for (const record of records) {
    validDay(record.day);
    if (record.day < start || record.day > today) continue;
    if (firstDay === null || record.day < firstDay) throw new Error("Inconsistent history range");
    if (!/^\d+$/.test(record.total)) throw new Error("Invalid aggregate count");
    const count = add(0, Number(record.total));
    const key = JSON.stringify([record.page, record.event, record.target, record.device]);
    const previous = summary.get(key);
    summary.set(key, { page: record.page, event: record.event, target: record.target, device: record.device, total: String(add(Number(previous?.total ?? 0), count)) });
    const metric = BEHAVIOR_METRICS.find(metric => metric.event === record.event);
    if (metric) {
      const day = byDay.get(record.day)!;
      day.counts[metric.key] = add(day.counts[metric.key], count);
      totals[metric.key] = add(totals[metric.key], count);
    }
  }
  const week = (startOffset: number, endOffset: number): BehaviorWeek => {
    const start = shiftBehaviorDay(today, startOffset), end = shiftBehaviorDay(today, endOffset);
    const days = daily.filter(day => day.day >= start && day.day <= end);
    const counts = emptyCounts();
    for (const day of days) for (const { key } of BEHAVIOR_METRICS) counts[key] = add(counts[key], day.counts[key]);
    // The first recorded day may have started mid-day; don't call it a full baseline.
    return { start, end, availableDays: days.filter(day => day.available).length, complete: firstDay !== null && firstDay < start, counts };
  };
  const currentWeek = week(-7, -1), previousWeek = week(-14, -8);
  const variations = Object.fromEntries(BEHAVIOR_METRICS.map(({ key }) => {
    const current = currentWeek.availableDays ? currentWeek.counts[key] : null;
    const previous = previousWeek.availableDays ? previousWeek.counts[key] : null;
    let variation: BehaviorVariation;
    if (!currentWeek.complete || !previousWeek.complete) variation = { current, previous, difference: null, percent: null, reason: "history" };
    else {
      const difference = currentWeek.counts[key] - previousWeek.counts[key];
      const baseline = previousWeek.counts[key];
      variation = { current, previous, difference, percent: baseline ? (Math.round(difference / baseline * 1000) / 10 || 0) : null, reason: baseline ? null : currentWeek.counts[key] ? "zero-base" : "no-events" };
    }
    return [key, variation];
  })) as Record<BehaviorMetric, BehaviorVariation>;
  const rows = [...summary.values()].sort((a, b) => Number(b.total) - Number(a.total) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { rows, insights: { today, firstDay, daily, totals, currentWeek, previousWeek, variations } satisfies BehaviorInsights };
}
