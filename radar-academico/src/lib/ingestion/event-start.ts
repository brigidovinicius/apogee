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
