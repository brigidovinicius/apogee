/** Validate optional event dates without turning unknown times into midnight. */
export function parseEventStart(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Início do evento inválido");
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.test(date)) throw new Error("Início do evento precisa de data válida e fuso quando houver horário");
  const day = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date.slice(0, 10) || !Number.isFinite(Date.parse(date))) throw new Error("Data de início do evento inválida");
  return date;
}

/** With no hour, withdraw conservatively at the start of the confirmed day in Brazil. */
export function eventHasNotStarted(value: unknown, now = new Date()): boolean {
  try {
    const start = parseEventStart(value);
    return Boolean(start && Date.parse(start.length === 10 ? `${start}T00:00:00-03:00` : start) > now.getTime());
  } catch { return false; }
}

/** Only an explicitly labelled event start; never a registration or publication date. */
export function eventStartFromText(text: string): string | null {
  const starts = [...text.matchAll(/(?:data (?:do evento|de realização)|início do evento|(?:o )?evento (?:acontece|ocorre|será realizado) (?:em|no dia))\s*:?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:às|a partir das)\s*(\d{1,2})(?:h|:)(\d{2})?)?/gi)];
  if (starts.length !== 1) return null;
  const [, day,month,year,hour,minute]=starts[0];
  const date=`${year}-${month.padStart(2,"0")}-${day.padStart(2,"0")}`;
  const match = starts[0];
  const startContext = text.slice(match.index, (match.index ?? 0) + match[0].length + 80).split(/[.;]\s/)[0];
  const brazilTime = /hor[aá]rio (?:oficial )?de Bras[ií]lia|(?:UTC|GMT)\s*-0?3(?::?00)?/i.test(startContext);
  try { return parseEventStart(hour && brazilTime ? `${date}T${hour.padStart(2,"0")}:${(minute ?? "00").padStart(2,"0")}:00-03:00` : date); }
  catch { return null; }
}
