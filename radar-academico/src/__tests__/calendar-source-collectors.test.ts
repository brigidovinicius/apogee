import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { calendarAuditSource, CALENDAR_SOURCES } from "@/lib/ingestion/calendar-sources";
import { normalizeCalendarSource } from "@/lib/ingestion/normalize-calendar-sources";
import { programmeCataloguePageCount, normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import { canonicalOpportunityKey } from "@/lib/ingestion/revision-key";
import { publicationIssue } from "@/lib/ingestion/publication";
import { comvest, fuvest } from "./fixtures/calendar-blocked-representative";

const now = new Date("2026-10-29T12:00:00Z");
const obmep = readFileSync(new URL("./fixtures/obmep-calendar-2026.html", import.meta.url), "utf8");
const obi = readFileSync(new URL("./fixtures/obi-calendar-2026.html", import.meta.url), "utf8");
const fixtures = [obmep, obi, comvest, fuvest];
const parse = (i: number, html = fixtures[i], at = now) => normalizeCalendarSource(html, calendarAuditSource(CALENDAR_SOURCES[i].id), at)[0];
const stages = (i: number, html = fixtures[i]) => parse(i, html).discovery!.editions[0].stages;

it("extracts only the audited OBMEP year and distinguishes answer cards, teachers and results", () => {
  const item = parse(0), dates = stages(0);
  expect(item).toMatchObject({ title: "OBMEP 2026", deadlineAt: "2026-03-16", opportunityStatus: "closed", applicationRoute: "institutional_call" });
  expect(dates).toHaveLength(8);
  expect(dates.find(s => s.id === "answer-cards")).toMatchObject({ kind: "event", start: "2026-06-22" });
  expect(dates.find(s => s.id === "result-1")).toMatchObject({ kind: "result", start: "2026-08-03" });
  expect(dates.find(s => s.id === "teacher-registration")).toMatchObject({ start: "2026-08-03", end: "2026-09-17" });
  expect(dates.find(s => s.id === "awards")?.start).toBe("2026-12-15");
  expect(dates.every(s => s.start.startsWith("2026"))).toBe(true);
  expect(publicationIssue(item, calendarAuditSource(item.officialSourceId), now)).toBe("status_unconfirmed");
});
it("OBI keeps schools, competitors and three modalities distinct", () => {
  const dates = stages(1);
  expect(dates.find(s => s.id === "school-iniciacao")?.start).toBe("2026-05-25");
  expect(dates.find(s => s.id === "competitor-iniciacao")?.start).toBe("2026-05-26T18:00:00-03:00");
  expect(dates.find(s => s.id === "school-programacao")?.start).toBe("2026-06-06");
  expect(dates.find(s => s.id === "competitor-programacao")?.start).toBe("2026-06-08T18:00:00-03:00");
  expect(dates.find(s => s.id === "competitor-cf-obi")?.start).toBe("2026-09-09");
  expect(parse(1).deadlineAt).toBe("2026-09-09");
});
it("expands OBI rowspans without transferring morning times to afternoon levels", () => {
  const exams = stages(1).filter(s => s.kind === "exam");
  expect(exams).toHaveLength(8);
  expect(exams.find(s => s.name.startsWith("Fase 3 — Programação — níveis Mirim"))).toMatchObject({ start: "2026-10-03T08:00:00-03:00", end: "2026-10-03T12:00:00-03:00" });
  expect(exams.find(s => s.name === "Fase 3 — Programação — níveis 2, Sênior")).toMatchObject({ start: "2026-10-03T13:00:00-03:00", end: "2026-10-03T18:00:00-03:00" });
  expect(exams.find(s => s.name.startsWith("Fase 1 — Iniciação"))).toMatchObject({ start: "2026-05-27", end: "2026-05-29" });
  expect(stages(1).find(s => s.id === "olympic-week")).toMatchObject({ start: "2026-12-06", end: "2026-12-12" });
  expect(stages(1).some(s => /Internacional|Europeia|Iberoamericana/.test(s.name))).toBe(false);
});
it("Comvest takes the explicit extension, preserves cross-year calls and does not ingest ENEM or payment as registration", () => {
  const item = parse(2), dates = stages(2);
  expect(item).toMatchObject({ deadlineAt: "2026-09-08T17:00:00-03:00", opportunityStatus: "closed", discovery: { subtype: "vestibular" } });
  expect(dates.filter(s => s.id === "registration-close")).toHaveLength(1);
  expect(dates.some(s => /ENEM/.test(s.name))).toBe(false);
  expect(dates.find(s => s.id === "enrollment-1")).toMatchObject({ start: "2027-01-26T09:00:00-03:00", end: "2027-01-27T17:00:00-03:00" });
  expect(dates.find(s => s.id === "enrollment-2")).toMatchObject({ start: "2027-02-02T09:00:00-03:00", end: "2027-02-03T17:00:00-03:00" });
  expect(dates.find(s => s.id === "enrollment-3")).toMatchObject({ start: "2027-02-12T09:00:00-03:00", end: "2027-02-12T17:00:00-03:00" });
});
it("Fuvest parser requires its edition and exact registration time, without guessing result or enrollment dates", () => {
  const item = parse(3);
  expect(item).toMatchObject({ deadlineAt: "2026-10-09T12:00:00-03:00", opportunityStatus: "closed" });
  expect(stages(3).filter(s => s.kind === "exam").map(s => s.start)).toEqual(["2026-11-01", "2026-12-06", "2026-12-07"]);
  expect(stages(3).some(s => s.kind === "result" || s.kind === "enrollment")).toBe(false);
});
it.each(CALENDAR_SOURCES.map((spec, i) => [spec.id, i] as const))("integrates %s with the collector/recheck adapter", (id, i) => {
  expect(programmeCataloguePageCount(id)).toBe(1);
  const source = calendarAuditSource(id);
  expect(normalizeProgrammeCatalogue(fixtures[i], "", source)).toHaveLength(1);
  expect(() => normalizeCalendarSource(fixtures[i], { ...source, listingUrls: [source.baseUrl + "unreviewed"] })).toThrow();
  expect(() => normalizeCalendarSource("<html>Access denied</html>", source)).toThrow();
});
it.each([
  [0, () => obmep.replace(">2026<", ">2027<")],
  [0, () => obmep.replace("15 de dezembro", "32 de dezembro")],
  [0, () => obmep.replace("Divulgação dos premiados", "Inscrições")],
  [1, () => obi.replace("25/05/2026", "25/05/2027")],
  [1, () => obi.replace('rowspan="3"', 'rowspan="9"')],
  [1, () => obi.replace("13:00-18:00", "horário a confirmar")],
  [2, () => comvest.replace(/<li>8 de Setembro[^<]*Último dia para inscrição[^<]*<\/li>/, "")],
  [2, () => comvest.replace("8 de Setembro de 2026", "31 de fevereiro de 2026")],
  [2, () => comvest.replace("02, 03 e 04", "02, 03 e 07")],
  [3, () => fuvest.replace("FUVEST 2027", "FUVEST 2026")],
  [3, () => fuvest.replace("09/10/2026", "31/02/2026")],
] as const)("fails closed on missing/ambiguous dates or changed structure (%s)", (i, fixture) => {
  expect(() => parse(i, fixture())).toThrow();
});
it("keeps identity and event IDs on retification; verification time alone is not a new content revision", () => {
  const before = parse(0), after = parse(0, obmep.replace("15 de dezembro", "16 de dezembro"));
  expect(before.contentHash).not.toBe(after.contentHash);
  expect(before.discovery!.editions[0].stages.map(s => s.id)).toEqual(after.discovery!.editions[0].stages.map(s => s.id));
  expect(canonicalOpportunityKey(before.officialSourceId, before.title, before.sourcePageUrl)).toBe(canonicalOpportunityKey(after.officialSourceId, after.title, after.sourcePageUrl));
  expect(parse(0, obmep, new Date("2026-10-29T13:00:00Z")).contentHash).toBe(before.contentHash);
});
it("respects the actual opening/deadline, including the exact closing minute", () => {
  expect(parse(3, fuvest, new Date("2026-08-17T14:59:59Z")).opportunityStatus).toBe("upcoming");
  expect(parse(3, fuvest, new Date("2026-10-09T15:00:00Z")).opportunityStatus).toBe("open");
  expect(parse(3, fuvest, new Date("2026-10-09T15:00:01Z")).opportunityStatus).toBe("closed");
});
it("registers all four sources inactive and pending without changing existing operator settings", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table official_sources(id text primary key,name text,institution_name text,institution_acronym text,source_type text,base_url text,
      allowed_domains text[],allowed_path_prefixes text[],listing_urls text[],extraction_mode text,audience_scope text[],geographic_scope text[],categories text[],
      priority int,active boolean,verification_status text,crawl_interval_hours int,notes text)`);
    const sql = readFileSync(new URL("../../db/migrations/0044_calendar_sources_local_validation.sql", import.meta.url), "utf8");
    await db.exec(sql);
    expect((await db.query("select count(*)::int as n from official_sources where not active and verification_status='pending'")).rows).toEqual([{ n: 4 }]);
    await db.exec("update official_sources set active=true,crawl_interval_hours=72 where id='obmep-calendar-2026'");
    await db.exec(sql);
    expect((await db.query("select active,crawl_interval_hours from official_sources where id='obmep-calendar-2026'")).rows).toEqual([{ active: true, crawl_interval_hours: 72 }]);
  } finally { await db.close(); }
});
