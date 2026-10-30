/** Pilot cadence; all other audited sources retain their existing schedule. */
export function sourceCheckHours(sourceId: string) {
  return sourceId === "nasa-space-apps-2026" ? 6 : 24;
}
