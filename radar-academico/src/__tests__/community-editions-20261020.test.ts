import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import corpus from "./fixtures/community-editions-20261020.json";
import { COMMUNITY_EDITIONS, MLH_GLOBAL_URL, normalizeCommunityEdition } from "@/lib/ingestion/normalize-community-editions-20261020";
import { programmeCataloguePageCount, programmeSupplementUrl, normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";

const now = new Date("2026-10-20T14:09:10Z");
const fixtures = corpus.editions;
function source(id: string): OfficialSource {
  const edition = COMMUNITY_EDITIONS.find(item => item.id === id)!;
  return { id, baseUrl: edition.url, listingUrls: [edition.url], active: true, institutionName: edition.institution,
    extractionMode: "html", allowedDomains: [new URL(edition.url).hostname, "ghw.mlh.com"],
    allowedPathPrefixes: [new URL(edition.url).pathname, ...(edition.supplement ? ["/"] : [])] } as OfficialSource;
}
const normalize = (fixture: typeof fixtures[number], at = now) =>
  normalizeCommunityEdition(fixture.html, corpus.mlhSupplement, source(fixture.id), at)[0];

it.each(fixtures)("publishes one audited organizer edition: $id", fixture => {
  const item = normalize(fixture);
  expect(item.opportunityStatus).toBe("open");
  expect(publicationIssue(item, source(fixture.id), now)).toBeNull();
  expect(normalizeCommunityEdition(fixture.html, corpus.mlhSupplement, source(fixture.id), now)).toHaveLength(1);
  expect(item.applicationUrl).toBe(item.sourcePageUrl);
  expect(item.isCourse).toBe(false);
  expect(programmeCataloguePageCount(fixture.id)).toBe(fixture.id.startsWith("mlh-") ? 2 : 1);
});

it.each(fixtures)("withdraws closed, cancelled and sold-out registrations: $id", fixture => {
  for (const notice of ["Inscrições encerradas.", "Evento cancelado.", "INGRESSOS ESGOTADOS"])
    expect(normalize({ ...fixture, html: fixture.html + `<p>${notice}</p>` }).opportunityStatus).not.toBe("open");
  expect(normalize({ ...fixture, html: fixture.html.replace(/href=/g, "data-removed=") }).opportunityStatus).toBe("closed");
});

it.each(fixtures)("does not accept a different source URL or invented edition: $id", fixture => {
  expect(() => normalizeCommunityEdition(fixture.html, corpus.mlhSupplement,
    { ...source(fixture.id), baseUrl: "https://example.org/other-edition" }, now)).toThrow();
  expect(() => normalizeCommunityEdition(fixture.html, corpus.mlhSupplement,
    { ...source(fixture.id), listingUrls: [source(fixture.id).baseUrl, "https://example.org/"] }, now)).toThrow();
  expect(normalizeCommunityEdition(fixture.html, corpus.mlhSupplement, { ...source(fixture.id), id: "unreviewed-edition" }, now)).toEqual([]);
});

it.each(fixtures)("requires renewed evidence when the edition year changes: $id", fixture => {
  expect(() => normalize({ ...fixture, html: fixture.html.replaceAll("2026", "2027") })).toThrow();
});

it.each(fixtures.filter(fixture => fixture.id !== "obvc-2026"))("keeps unknown registration deadline separate from event start: $id", fixture => {
  const item = normalize(fixture);
  expect(item.deadlineAt).toBeUndefined();
  expect(item.deadlinePrecision).toBe("not_informed");
  expect(item.evidenceJson.registration_availability).toBeDefined();
  expect(normalize(fixture, new Date(item.eventStartsAt + "T00:00:00-03:00")).opportunityStatus).toBe("closed");
  expect(publicationIssue(item, source(fixture.id), new Date(item.eventStartsAt + "T00:00:00-03:00"))).toBe("invalid_deadline");
});

it("keeps OBVC paid, caps conditional, and registration distinct from submission", () => {
  const fixture = fixtures.find(item => item.id === "obvc-2026")!;
  const item = normalize(fixture);
  expect(item).toMatchObject({ deadlineAt: "2026-10-31", deadlinePrecision: "date_only", nationallyEligible: true, stateCode: null, cityName: null });
  expect(item.eventStartsAt).toBeUndefined();
  expect(item.amountText).toContain("Inscrição paga");
  expect(item.amountText).toContain("tetos condicionais");
  expect(normalize(fixture, new Date("2026-10-31T23:59:59-03:00")).opportunityStatus).toBe("open");
  expect(normalize(fixture, new Date("2026-11-01T00:00:00-03:00")).opportunityStatus).toBe("closed");
});

it("requires the MLH global eligibility supplement and avoids classifying points as cash competition", () => {
  for (const fixture of fixtures.filter(item => item.id.startsWith("mlh-"))) {
    expect(programmeSupplementUrl(fixture.id)).toBe(MLH_GLOBAL_URL);
    expect(() => normalizeCommunityEdition(fixture.html, "", source(fixture.id), now)).toThrow();
    expect(() => normalizeCommunityEdition(fixture.html,
      '<script>"Global Hack Week is a 100% free event for anyone, anywhere!"</script>', source(fixture.id), now)).toThrow();
    expect(normalize(fixture)).toMatchObject({ categories: ["eventos"], nationallyEligible: true, countryCode: null, stateCode: null, cityName: null, geographicScopeKind: "global" });
    const item = normalizeProgrammeCatalogue(fixture.html, corpus.mlhSupplement, source(fixture.id))[0];
    expect(item.officialSourceId).toBe(fixture.id);
  }
});

it("keeps closed ENAP speaker submissions separate from open attendance", () => {
  const fixture = fixtures.find(item => item.id === "enap-innovation-week-2026")!;
  expect(fixture.html).toContain("o prazo de envio foi encerrado no primeiro semestre");
  expect(normalize(fixture).opportunityStatus).toBe("open");
  expect(normalize({ ...fixture, html: fixture.html.replace("2026 já estão abertas", "2026 estão encerradas") }).opportunityStatus).toBe("closed");
});

it("stages exactly ten inactive pending sources and preserves pre-existing flags on reapplication", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create table official_sources (id text primary key,name text,institution_name text,institution_acronym text,
      source_type text,base_url text,allowed_domains text[],allowed_path_prefixes text[],listing_urls text[],extraction_mode text,
      audience_scope text[],geographic_scope text[],categories text[],priority int,active boolean,verification_status text,
      crawl_interval_hours int,notes text);`);
    const migration = readFileSync(new URL("../../db/migrations/0037_audited_community_editions.sql", import.meta.url), "utf8");
    await db.exec(migration);
    const staged = await db.query<{ id: string; active: boolean; verification_status: string }>("select id,active,verification_status from official_sources order by id");
    expect(staged.rows.map(row => row.id)).toEqual(COMMUNITY_EDITIONS.map(item => item.id).sort());
    expect(staged.rows.every(row => !row.active && row.verification_status === "pending")).toBe(true);
    await db.exec("update official_sources set active=true,verification_status='verified' where id='obvc-2026'");
    await db.exec(migration);
    expect((await db.query("select count(*)::int as n from official_sources")).rows[0]).toEqual({ n: 10 });
    expect((await db.query("select active,verification_status from official_sources where id='obvc-2026'")).rows[0]).toEqual({ active: true, verification_status: "verified" });
  } finally { await db.close(); }
});
