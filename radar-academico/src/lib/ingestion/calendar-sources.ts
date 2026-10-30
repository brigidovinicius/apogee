import type { OfficialSource } from "./types";

/** Edition-bound adapters: a new year requires a new audited source, never an inferred rollover. */
export const CALENDAR_SOURCES = [
  { id: "obmep-calendar-2026", name: "OBMEP 2026", institution: "Instituto de Matemática Pura e Aplicada", url: "https://www.obmep.org.br/calendario.htm", edition: "2026", subtype: "olimpiada", areas: ["matematica"] },
  { id: "obi-calendar-2026", name: "Olimpíada Brasileira de Informática 2026", institution: "Instituto de Computação — Unicamp", url: "https://olimpiada.ic.unicamp.br/calendario/datas_importantes", edition: "2026", subtype: "olimpiada", areas: ["tecnologia"] },
  { id: "comvest-vestibular-2027", name: "Vestibular Unicamp 2027", institution: "Comvest — Unicamp", url: "https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/", edition: "2027", subtype: "vestibular", areas: [] },
  { id: "fuvest-vestibular-2027", name: "Vestibular FUVEST 2027", institution: "FUVEST — Universidade de São Paulo", url: "https://www.fuvest.br/vestibular-da-usp/", edition: "2027", subtype: "vestibular", areas: [] },
] as const;

export const calendarSource = (id: string) => CALENDAR_SOURCES.find(source => source.id === id);

/** An in-memory descriptor for read-only audits. This never registers or activates a DB source. */
export function calendarAuditSource(id: string): OfficialSource {
  const spec = calendarSource(id);
  if (!spec) throw new Error("Fonte de calendário desconhecida");
  const url = new URL(spec.url);
  return { id, name: spec.name, institutionName: spec.institution, institutionAcronym: "", sourceType: "official_reference",
    baseUrl: spec.url, listingUrls: [spec.url], allowedDomains: [url.hostname], allowedPathPrefixes: [url.pathname],
    extractionMode: "html", active: true, audienceScope: ["mixed"], geographicScope: [],
    categories: [spec.subtype === "olimpiada" ? "competicoes" : "formacao"], priority: 80 };
}
