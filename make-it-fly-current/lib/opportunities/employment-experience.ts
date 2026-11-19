/** Prefer the structured minimum; use only an explicit, unambiguous range otherwise. */
export function employmentExperienceSummary(minimumYears: number | null, requirements: string): string {
  if (minimumYears !== null) return `${minimumYears}+ anos`;

  const ranges = [...requirements.matchAll(
    /(?<![\d.+-])\b(\d{1,2})\s*(?:to|[-–—]|a|at[eé])\s*(\d{1,2})\s+(?:years?|anos?)\s+(?:de\s+experi[êe]ncia|(?:of\s+)?(?:professional\s+|relevant\s+)?experience)\b/giu,
  )].map(match => [Number(match[1]), Number(match[2])] as const);
  if (!ranges.length || ranges.some(([min, max]) => min > max || max > 60)) return "Não informada";
  if (new Set(ranges.map(([min, max]) => `${min}:${max}`)).size !== 1) return "Não informada";

  const [min, max] = ranges[0];
  return min === max ? `${min} ${min === 1 ? "ano" : "anos"}` : `${min} a ${max} ${max === 1 ? "ano" : "anos"}`;
}
