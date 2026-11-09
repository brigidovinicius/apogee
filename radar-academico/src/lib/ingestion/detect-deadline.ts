import type { DeadlinePrecision } from './types';
import { explicitDatesToNumeric } from './explicit-dates';

function validDate(day: string, month: string, year: string) {
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return value.getUTCFullYear() === Number(year) && value.getUTCMonth() + 1 === Number(month) && value.getUTCDate() === Number(day);
}
type Deadline = { deadlineAt?: string; precision: DeadlinePrecision; stated?: boolean };
const missing = (): Deadline => ({ precision: 'not_informed', stated: true });

export function detectDeadline(raw: string): Deadline {
  const text = explicitDatesToNumeric(raw.replace(/\s+/gu, ' '))
    .replace(/(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/gu, '$1/$2/$3');
  const contexts = [...text.matchAll(/(?=((?:inscriç(?:ão|ões)|inscrever(?:-se)?|candidaturas?|candidatar(?:-se)?|submiss(?:ão|ões)|prazo(?: de inscrição)?).{0,160}))/gi)].map(match => {
    const prefix = text.slice(Math.max(0, match.index - 45), match.index);
    const closingLabel = /(?:encerramento|término|data limite)(?: d[ae]s?)?\s*$/i.exec(prefix)?.[0] ?? '';
    return (closingLabel + match[1]).split(/[.;]\s|\b(?:publicad[oa]s?|atualizad[oa]s?|divulgação|resultados?|classificaç(?:ão|ões)|sorteio|recursos?|matrículas?|etapa presencial|realização)\b|data (?:do evento|de realização)|início (?:do evento|do curso)|(?:o )?evento (?:acontece|ocorre|será realizado)/i)[0];
  });
  const candidates: { day: string; value: string; exact: boolean }[] = [];
  let invalid = false;
  for (const context of contexts) {
    const dates = [...context.matchAll(/(?<!\d)(\d{1,2})\/(\d{1,2})\/(\d{4})(?!\d)/g)];
    const selected: RegExpExecArray[] = [];
    // A date range names its endpoint. A timetable's later result date does not.
    for (let i = 1; i < dates.length; i++) {
      const between = context.slice(dates[i - 1].index! + dates[i - 1][0].length, dates[i].index).trim();
      if (/^(?:a|até|e)$/i.test(between)) selected.push(dates[i]);
    }
    if (!selected.length) {
      for (const marker of context.matchAll(/\b(?:até|prazo|encerr[\p{L}]*|termin[\p{L}]*|término|limite)(?!\p{L})/giu)) {
        const end = marker.index! + marker[0].length;
        const date = dates.find(date => date.index! >= end && date.index! - end <= 80);
        if (date) selected.push(date);
      }
    }
    // Only the endpoint carries a full year in "de 9 de março a 5 de maio de
    // 2026". Read that explicit endpoint without inventing a year for the start.
    if (!selected.length) for (const date of dates) {
      const before = context.slice(0, date.index);
      if (/(?:\bde\s+|:\s*)\d{1,2}(?:\/\d{1,2}|\s+de\s+(?:janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))\s+(?:a|até)\s*$/iu.test(before)) selected.push(date);
    }
    for (const date of selected) {
      const [, day, month, year] = date;
      if (!validDate(day, month, year)) { invalid = true; continue; }
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const after = context.slice(date.index! + date[0].length);
      const before = context.slice(0, date.index);
      const clock = /^\s*(?:\((?:(?:segunda|terça|quarta|quinta|sexta)(?:-feira)?|sábado|domingo)\)\s*)?,?\s*(?:(?:às|as|até às|até as)\s*)?(\d{1,3})(?:h|:)(\d*)/i.exec(after) ??
        /(?:às|as)\s*(\d{1,3})(?:h|:)(\d*)\s*(?:do dia\s*)?$/i.exec(before);
      if (clock && (Number(clock[1]) > 23 || clock[1].length > 2 || Number(clock[2] || '00') > 59 ||
        clock[2].length !== 0 && clock[2].length !== 2 || !clock[2] && clock[0].includes(':'))) { invalid = true; continue; }
      candidates.push({ day: iso, exact: Boolean(clock), value: clock ? `${iso}T${clock[1].padStart(2, '0')}:${(clock[2] || '00').padStart(2, '0')}:00-03:00` : iso });
    }
  }
  if (invalid || new Set(candidates.map(c => c.day)).size > 1) return missing();
  const exact = [...new Set(candidates.filter(c => c.exact).map(c => c.value))];
  if (exact.length > 1) return missing();
  if (exact.length) return { deadlineAt: exact[0], precision: 'exact_datetime' };
  if (candidates.length) return { deadlineAt: candidates[0].value, precision: 'date_only' };
  if (contexts.some(context => /até|encerr|termin|limite|prazo/i.test(context))) return missing();
  if (/inscriç(?:ão|ões).{0,50}(?:fluxo contínuo|demanda contínua)/i.test(text)) return { precision: 'continuous_flow' };
  return { precision: 'not_informed' };
}
