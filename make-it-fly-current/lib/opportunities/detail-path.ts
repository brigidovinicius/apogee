export function opportunityDetailPath(id: string) {
  return `/membros/oportunidades/${encodeURIComponent(id)}`;
}

// Only an internal opportunity detail can be a checkout return destination.
export function radarDetailReturnPath(value: unknown) {
  return typeof value === "string" && /^\/membros\/oportunidades\/[A-Za-z0-9_-]+$/.test(value)
    ? value : "/membros/oportunidades";
}
