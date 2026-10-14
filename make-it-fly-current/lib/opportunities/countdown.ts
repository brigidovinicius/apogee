import type { StudentOpportunity } from "./types";

type Countdown = { label: string; value: string; tone: "safe" | "urgent" | null; target: string | null };
const brazilDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});
function dayNumber(date: string) { return Date.parse(`${date}T12:00:00Z`) / 86_400_000; }

/** Date-only sources count calendar days; only confirmed timestamps count seconds. */
export function opportunityCountdown(opportunity: Pick<StudentOpportunity, "categories" | "deadline" | "deadlineAt" | "eventStartsAt">, now: number | null): Countdown {
  const event = opportunity.categories?.includes("eventos") === true;
  const target = event ? opportunity.eventStartsAt : opportunity.deadlineAt ?? opportunity.deadline;
  const label = event ? "Início do evento" : "Encerramento das inscrições";
  const unknown: Countdown = { label, value: event ? "Data de início não informada" : "Sem prazo definido", tone: null, target: null };
  if (!target) return unknown;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(target);
  const date = new Date(`${target.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== target.slice(0, 10) ||
      (!dateOnly && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(target)) || !Number.isFinite(Date.parse(target))) return unknown;
  if (now === null) return { label, value: "Calculando tempo restante…", tone: null, target };
  if (dateOnly) {
    const parts = brazilDay.formatToParts(new Date(now));
    const part = (type: string) => parts.find((item) => item.type === type)?.value;
    const days = Math.round(dayNumber(target) - dayNumber(`${part("year")}-${part("month")}-${part("day")}`));
    const value = days > 0 ? `Falta${days === 1 ? "" : "m"} ${days} dia${days === 1 ? "" : "s"}` : days === 0
      ? event ? "Evento hoje · horário não informado" : "Encerra hoje · horário não informado"
      : event ? "Data de início já passou" : "Inscrições encerradas";
    return { label, value, tone: days < 0 ? null : days <= 7 ? "urgent" : "safe", target };
  }
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  if (!seconds) return { label, value: event ? "Evento iniciado" : "Inscrições encerradas", tone: null, target };
  const days = Math.floor(seconds / 86400);
  const pad = (value: number) => String(value).padStart(2, "0");
  return { label, value: `${days > 0 ? `${days}d ` : ""}${pad(Math.floor(seconds % 86400 / 3600))}h ${pad(Math.floor(seconds % 3600 / 60))}min ${pad(seconds % 60)}s`, tone: Date.parse(target) - now <= 7 * 86_400_000 ? "urgent" : "safe", target };
}
