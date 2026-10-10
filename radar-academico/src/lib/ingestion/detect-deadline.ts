import type { DeadlinePrecision } from "./types";

function validDate(day: string, month: string, year: string) {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return value.getUTCFullYear() === Number(year) &&
    value.getUTCMonth() + 1 === Number(month) && value.getUTCDate() === Number(day);
}

export function detectDeadline(text: string): { deadlineAt?: string; precision: DeadlinePrecision } {
  if (/fluxo contínuo|demanda contínua/i.test(text)) return { precision: "continuous_flow" };
  const dateTime = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}).{0,20}?(\d{1,2})h(?:(\d{2}))?/i);
  if (dateTime) {
    const [, day, month, year, hour, minute = "00"] = dateTime;
    if (!validDate(day, month, year) || Number(hour) > 23 || Number(minute) > 59) {
      return { precision: "not_informed" };
    }
    return { deadlineAt: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00-03:00`, precision: "exact_datetime" };
  }
  const date = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (date) {
    const [, day, month, year] = date;
    if (!validDate(day, month, year)) return { precision: "not_informed" };
    return { deadlineAt: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, precision: "date_only" };
  }
  if (/entre|período|de \d{1,2}\/\d{1,2}/i.test(text)) return { precision: "period_only" };
  return { precision: "not_informed" };
}
