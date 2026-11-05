const months: Record<string, string> = { janeiro: '01', fevereiro: '02', março: '03', abril: '04', maio: '05', junho: '06',
  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12' };

/** A spelling conversion only: a missing year remains missing and dates are validated by the caller. */
export function explicitDatesToNumeric(text: string) {
  return text.replace(/\b(\d{1,2})[º°]?\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{4})\b/giu,
    (_, day: string, month: string, year: string) => `${day.padStart(2, '0')}/${months[month.toLowerCase()]}/${year}`);
}
