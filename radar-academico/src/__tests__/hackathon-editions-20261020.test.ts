import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import corpus from "./fixtures/hackathon-editions-20261020.json";
import { HACKATHON_EDITIONS, normalizeHackathonEdition } from "@/lib/ingestion/normalize-hackathon-editions-20261020";
import { programmeCataloguePageCount, programmeSupplementUrl, normalizeProgrammeCatalogue } from "@/lib/ingestion/programme-catalogue";
import { publicationIssue } from "@/lib/ingestion/publication";
import type { OfficialSource } from "@/lib/ingestion/types";
const now = new Date("2026-10-20T16:00:00Z");
function source(id: string): OfficialSource {
 const e = HACKATHON_EDITIONS.find(item => item.id === id)!;
 return { id, baseUrl: e.url, listingUrls: [e.url], active: true, institutionName: e.institution,
  extractionMode: "html", allowedDomains: [new URL(e.url).hostname],
  allowedPathPrefixes: [new URL(e.url).pathname, ...(e.supplement ? [new URL(e.supplement).pathname] : [])] } as OfficialSource;
}
const normalize = (fixture: typeof corpus.editions[number], at = now) =>
 normalizeHackathonEdition(fixture.html, corpus.decolaSupplement, source(fixture.id), at)[0];
it.each(corpus.editions)("publishes one audited edition: $id", fixture => {
 const item=normalize(fixture);
 expect(item.opportunityStatus).toBe("open"); expect(publicationIssue(item,source(fixture.id),now)).toBeNull();
 expect(item.categories).toContain("competicoes"); expect(item.applicationUrl).toBe(item.sourcePageUrl);
 expect(normalizeProgrammeCatalogue(fixture.html,corpus.decolaSupplement,source(fixture.id))).toHaveLength(1);
 expect(programmeCataloguePageCount(fixture.id)).toBe(fixture.id.startsWith("senac-") ? 2 : 1);
});
it.each(corpus.editions)("withdraws terminal notice, lost link, or expired participation: $id", fixture=>{
 for(const notice of ["Inscrições encerradas.","Evento cancelado.","INGRESSOS ESGOTADOS","Registration closed","Submissions closed"])
  expect(normalize({...fixture,html:fixture.html+`<p>${notice}</p>`}).opportunityStatus).not.toBe("open");
 expect(normalize({...fixture,html:fixture.html.replaceAll("href=","data-removed=")}).opportunityStatus).toBe("closed");
 expect(normalize(fixture,new Date("2027-01-01T00:00:00Z")).opportunityStatus).toBe("closed");
});
it.each(corpus.editions)("rejects changed edition, hidden facts and unrelated URLs: $id", fixture=>{
 expect(()=>normalize({...fixture,html:fixture.html.replaceAll("2026","2027")})).toThrow();
 expect(()=>normalize({...fixture,html:`<script>${fixture.html}</script>`})).toThrow();
 expect(()=>normalizeHackathonEdition(fixture.html,corpus.decolaSupplement,{...source(fixture.id),baseUrl:"https://example.org/"},now)).toThrow();
 expect(()=>normalizeHackathonEdition(fixture.html,corpus.decolaSupplement,{...source(fixture.id),listingUrls:[source(fixture.id).baseUrl,"https://example.org/"]},now)).toThrow();
});
it("requires the Decola PDF including IP and Figma; uses the general registration deadline",()=>{
 const fixture=corpus.editions.find(e=>e.id.startsWith("senac-"))!;
 expect(programmeSupplementUrl(fixture.id)).toContain("Regulamento");
 for(const supplement of ["",corpus.decolaSupplement.replace("titularidadedo SENACMS","autoria"),corpus.decolaSupplement.replace("Figma","")])
  expect(()=>normalizeHackathonEdition(fixture.html,supplement,source(fixture.id),now)).toThrow();
 expect(normalize(fixture)).toMatchObject({deadlineAt:"2026-10-26",deadlinePrecision:"date_only",stateCode:"MS",cityName:"Dourados"});
 expect(normalize(fixture).requirementsText).toContain("titularidade do Senac MS");
});
it("keeps the SJC registration date unknown and withdraws at the confirmed start",()=>{
 const fixture=corpus.editions.find(e=>e.id.includes("sjc"))!;const item=normalize(fixture);
 expect(item.deadlineAt).toBeUndefined();expect(item.deadlinePrecision).toBe("not_informed");
 expect(item.eventStartsAt).toBe("2026-10-31");expect(item.amountText).toContain("Taxa de inscrição não informada");
 expect(publicationIssue(item,source(fixture.id),new Date("2026-10-31T00:00:00-03:00"))).toBe("invalid_deadline");
});
it("does not close Junction because its separate travel grants closed, or invent a Brazilian location",()=>{
 const item=normalize(corpus.editions.find(e=>e.id==="junction-2026")!);
 expect(item).toMatchObject({opportunityStatus:"open",deadlineAt:"2026-10-25",deadlinePrecision:"date_only",countryCode:"FI",stateCode:null,cityName:null,nationallyEligible:false});
 expect(item.amountText).toContain("Taxa de participação não confirmada");
});
it("marks ClimX as submission rather than registration; never invents an event date",()=>{
 const item=normalize(corpus.editions.find(e=>e.id==="climx-2026")!);
 expect(item).toMatchObject({deadlineAt:"2026-12-15",eventStartsAt:null,countryCode:null,geographicScopeKind:"global"});
 expect(item.evidenceJson.submission_deadline.excerpt).toContain("prazo separado de inscrição não informado");
 expect(item.amountText).toContain("€ 3.300");expect(item.requirementsText).toContain("MIT ou Apache-2.0");
});
it.each(HACKATHON_EDITIONS.filter(e=>e.dynamic))("prepares two-page dynamic adapter but rejects empty JS envelopes: $id",edition=>{
 expect(programmeCataloguePageCount(edition.id)).toBe(2);expect(programmeSupplementUrl(edition.id)).toBe(edition.supplement);
 expect(()=>normalizeHackathonEdition(`<title>${edition.title}</title><div id="root"></div>`,"",source(edition.id),now)).toThrow(/Conteúdo dinâmico oficial incompleto/);
});
it("stages exactly eight inactive pending sources and preserves activation flags on replay",async()=>{
 const db=new PGlite();try{
 await db.exec(`create table official_sources (id text primary key,name text,institution_name text,institution_acronym text,source_type text,base_url text,allowed_domains text[],allowed_path_prefixes text[],listing_urls text[],extraction_mode text,audience_scope text[],geographic_scope text[],categories text[],priority int,active boolean,verification_status text,crawl_interval_hours int,notes text)`);
 const migration=readFileSync(new URL("../../db/migrations/0038_audited_hackathon_editions.sql",import.meta.url),"utf8");
 await db.exec(migration);const rows=(await db.query<{id:string;active:boolean;verification_status:string}>("select id,active,verification_status from official_sources order by id")).rows;
 expect(rows.map(r=>r.id)).toEqual(HACKATHON_EDITIONS.map(e=>e.id).sort());expect(rows.every(r=>!r.active&&r.verification_status==="pending")).toBe(true);
 await db.exec("update official_sources set active=true,verification_status='verified' where id='climx-2026'");await db.exec(migration);
 expect((await db.query("select active,verification_status from official_sources where id='climx-2026'")).rows[0]).toEqual({active:true,verification_status:"verified"});
 }finally{await db.close();}
});
