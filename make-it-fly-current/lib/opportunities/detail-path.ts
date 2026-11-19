import { calendarReturnPath } from './calendar-navigation';
import { radarCatalogueQuery } from './navigation';

export function opportunityDetailPath(id: string, params = new URLSearchParams()) {
  return `/membros/oportunidades/${encodeURIComponent(id)}${radarCatalogueQuery(params)}`;
}

// Calendar/card actions can return to their canonical internal context after purchase.
export function radarDetailReturnPath(value: unknown) {
  if (typeof value === "string" && /^\/membros\/meu-calendario\/salvar\/radar-[A-Za-z0-9_-]{1,194}(?:\?|$)/.test(value)) return calendarReturnPath(value);
  if(typeof value==='string'&&/^\/membros\/(?:colecoes(?:\/[0-9a-f-]{36}|\/acompanhadas|\/seguir\/[a-f0-9]{48})?|meu-calendario|oportunidades)(?:\?|$)/.test(value))return calendarReturnPath(value);
  const detail = typeof value === "string" && value.length <= 4096
    ? /^\/membros\/oportunidades\/([A-Za-z0-9_-]{1,200})(?:\?([^#]*))?$/.exec(value)
    : null;
  if (detail) {
    const params = new URLSearchParams(detail[2]);
    if (!detail[2] || radarCatalogueQuery(params)) return opportunityDetailPath(detail[1], params);
  }
  return "/membros/oportunidades";
}
