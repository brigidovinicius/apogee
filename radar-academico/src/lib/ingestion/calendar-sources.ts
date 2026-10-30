import type { OfficialSource } from "./types";

/** Vestibular evidence comes from independently accessible university publications; no blocked-host fallback.
 * Edition-bound adapters: a new year requires a new audited source, never an inferred rollover. */
export const CALENDAR_SOURCES = [
  { id: "obmep-calendar-2026", name: "OBMEP 2026", institution: "Instituto de Matemática Pura e Aplicada", url: "https://www.obmep.org.br/calendario.htm", edition: "2026", subtype: "olimpiada", areas: ["matematica"] },
  { id: "obi-calendar-2026", name: "Olimpíada Brasileira de Informática 2026", institution: "Instituto de Computação — Unicamp", url: "https://olimpiada.ic.unicamp.br/calendario/datas_importantes", edition: "2026", subtype: "olimpiada", areas: ["tecnologia"] },
  { id: "comvest-vestibular-2027", name: "Vestibular Unicamp 2027", institution: "Comvest — Unicamp", url: "https://www.unicamp.br/noticias/2026/08/31/unicamp-prorroga-inscricoes-para-o-vestibular-2027-ate-8-de-setembro/", edition: "2027", subtype: "vestibular", areas: [] },
  { id: "fuvest-vestibular-2027", name: "Vestibular FUVEST 2027", institution: "FUVEST — Universidade de São Paulo", url: "https://jornal.usp.br/universidade/guia-de-jornada-orienta-candidatos-sobre-etapas-do-vestibular-para-ingresso-na-usp/", edition: "2027", subtype: "vestibular", areas: [] },
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
