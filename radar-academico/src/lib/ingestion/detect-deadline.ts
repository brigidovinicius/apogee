import type { DeadlinePrecision } from "./types";

function validDate(day: string, month: string, year: string) {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return value.getUTCFullYear() === Number(year) &&
    value.getUTCMonth() + 1 === Number(month) && value.getUTCDate() === Number(day);
}

export function detectDeadline(text: string): { deadlineAt?: string; precision: DeadlinePrecision } {
  if (/inscriç(?:ão|ões).{0,50}(?:fluxo contínuo|demanda contínua)/i.test(text)) return { precision: "continuous_flow" };
  // Look near an explicit application deadline. An arbitrary date on an
  // official page may be the publication date or the start of a course.
  const deadlineContexts = [...text.matchAll(/(?:inscriç(?:ão|ões)|candidaturas|submissões|prazo(?: de inscrição)?).{0,140}/gi)].map((match) => match[0]);
  const deadlineContext = deadlineContexts.find((context) => /\d{1,2}\/\d{1,2}\/\d{4}/.test(context));
  if (!deadlineContext) return { precision: "not_informed" };
  const dates = [...deadlineContext.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
  const finalDate = dates.at(-1);
  if (!finalDate) return { precision: "not_informed" };
  const dateText = deadlineContext.slice(finalDate.index ?? 0);
  const dateTime = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}).{0,20}?(\d{1,2})h(?:(\d{2}))?/i);
  if (dateTime) {
    const [, day, month, year, hour, minute = "00"] = dateTime;
    if (!validDate(day, month, year) || Number(hour) > 23 || Number(minute) > 59) {
      return { precision: "not_informed" };
    }
    return { deadlineAt: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:00-03:00`, precision: "exact_datetime" };
  }
  if (finalDate) {
    const [, day, month, year] = finalDate;
    if (!validDate(day, month, year)) return { precision: "not_informed" };
    return { deadlineAt: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, precision: "date_only" };
  }
  if (/entre|período|de \d{1,2}\/\d{1,2}/i.test(text)) return { precision: "period_only" };
  return { precision: "not_informed" };
}
