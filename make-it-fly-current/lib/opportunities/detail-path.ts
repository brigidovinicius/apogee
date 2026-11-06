import { calendarReturnPath } from './calendar-navigation';

export function opportunityDetailPath(id: string) {
  return `/membros/oportunidades/${encodeURIComponent(id)}`;
}

// Calendar/card actions can return to their canonical internal context after purchase.
export function radarDetailReturnPath(value: unknown) {
  if(typeof value==='string'&&/^\/membros\/(?:colecoes(?:\/[0-9a-f-]{36}|\/acompanhadas|\/seguir\/[a-f0-9]{48})?|meu-calendario|oportunidades)(?:\?|$)/.test(value))return calendarReturnPath(value);
  return typeof value === "string" && /^\/membros\/oportunidades\/[A-Za-z0-9_-]+$/.test(value)
    ? value : "/membros/oportunidades";
}
