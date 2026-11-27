import "server-only";
import { opportunityDetailPath } from "./detail-path";
import type { ProfileMatch } from "./profile-match";
import { RADAR_PREFERENCES, type RadarEmail } from "./radar-preferences";
import { dateInBrazil } from "./types";

const hour = 3_600_000;
const day = 24 * hour;
const brDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", dateStyle: "short",
});

export function radarMatchesForMail(matches: readonly ProfileMatch[], now: Date, enabledAt: Date) {
  const time = now.getTime();
  return matches.filter(({ opportunity, canNotify, deadlineTime }) => {
    const published = Date.parse(opportunity.publishedAt ?? "");
    const verified = Date.parse(opportunity.verificationTimestamp ?? opportunity.verifiedAt);
    return canNotify && deadlineTime >= time + 6 * hour &&
      published >= Math.max(time - 7 * day, enabledAt.getTime()) && published <= time &&
      verified >= time - 7 * day && verified <= time;
  });
}

export function planRadarDigest(matches: readonly ProfileMatch[], email: RadarEmail, now: Date, sent: {
  keys: ReadonlySet<string>; opportunityIds: ReadonlySet<string>;
}, origin: string) {
  const actionable = matches.filter(({ opportunity }) => !sent.opportunityIds.has(opportunity.id));
  if (email === "off" || !actionable.length) return null;
  const today = dateInBrazil(now);
  const week = new Date(`${today}T00:00:00Z`);
  week.setUTCDate(week.getUTCDate() - (week.getUTCDay() + 6) % 7);
  const weeklyKey = `weekly-${week.toISOString().slice(0, 10)}`;
  const urgentKey = `urgent-${today}`;
  const regular = !sent.keys.has(weeklyKey);
  if (!regular && (email !== "urgent" || sent.keys.has(urgentKey))) return null;
  const soon = now.getTime() + 72 * hour;
  const selected = (regular ? actionable : actionable.filter(({ deadlineTime }) => deadlineTime <= soon)).slice(0, 5);
  if (!selected.length) return null;
  const detailParams = new URLSearchParams({ origem: "para-voce" });
  const entries = selected.map(({ opportunity, reason, deadlineTime }) => [
    opportunity.title.replace(/[\r\n]+/g, " "),
    reason,
    `Prazo: ${opportunity.deadlineAt ? new Date(deadlineTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) + " (Brasília)" : brDate.format(deadlineTime)}`,
    new URL(opportunityDetailPath(opportunity.id, detailParams), origin).href,
  ].join("\n"));
  return {
    key: regular ? weeklyKey : urgentKey,
    opportunityIds: selected.map(({ opportunity }) => opportunity.id),
    subject: regular ? "Radar Apogee · Oportunidades para você" : "Radar Apogee · Prazos próximos",
    body: [...entries, "Confira os requisitos e a fonte oficial na ficha.",
      `Alterar ou desativar estes avisos: ${new URL(RADAR_PREFERENCES, origin).href}`].join("\n\n"),
  };
}
