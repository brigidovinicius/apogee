const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export const formatDateTime = (value: Date | string) => dateTime.format(new Date(value));
export const formatMonthYear = (value: Date | string) => dateOnly.format(new Date(value));

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}
