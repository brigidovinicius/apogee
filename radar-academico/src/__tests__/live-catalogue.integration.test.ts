import { expansionSources } from "@/lib/ingestion/normalize-expansion";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/db/client", () => ({
  withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) => state.db!.transaction(async (tx) => {
    await tx.exec("set local role radar_editor; select set_config('app.is_admin','true',true)");
    return work(tx as unknown as PoolClient);
  }),
  queryPublic: (sql: string, values: unknown[] = []) => state.db!.transaction(async (tx) => {
    await tx.exec("set local role radar_reader; select set_config('app.is_admin','false',true)");
    return tx.query(sql, values);
  }),
}));
vi.mock("@/lib/ingestion/fetch-source", async importOriginal => ({
 ...(await importOriginal<typeof import("@/lib/ingestion/fetch-source")>()), fetchOfficialResource: vi.fn(),
}));
vi.mock("@/lib/alerts/mail", () => ({ alertsAvailable:()=>true, alertMailConfiguration:vi.fn(()=>({dailyLimit:50})), sendAlertMail:vi.fn() }));
import { alertMailConfiguration, sendAlertMail } from "@/lib/alerts/mail";
import { subscribeToOpportunity, updateAlertSubscription, queueOpportunityChanges, runOpportunityAlerts } from "@/lib/alerts/monitoring";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { recheckKnownOpportunities } from "@/lib/ingestion/recheck";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";
import { listLiveCatalogue, listCalendarCatalogue } from "@/lib/db/live-catalogue";
import { manageCatalogue } from "@/lib/official-sources/catalogue-management";
import { claimDueOfficialSources, completeScheduledSource } from "@/lib/ingestion/official-source-registry";
import { claimDueDiscoveryTargets, completeDiscoveryTarget } from "@/lib/discovery/watchlist";
import { withAdminTransaction } from "@/lib/db/client";
import { FGV_DATATHON_ID, CPS_ROBOCODE_ID, IFMG_JECT_ID, AMAZONIA_ID } from "@/lib/ingestion/normalize-extracurricular-20261017";
import { calendarAuditSource } from "@/lib/ingestion/calendar-sources";
import { runOfficialSourceIngestion } from "@/lib/ingestion";

const source: OfficialSource = { id: "test-source", name: "Instituto", institutionName: "Instituto", institutionAcronym: "IF",
 sourceType: "federal_institute", baseUrl: "https://example.edu.br/", allowedDomains: ["example.edu.br"], allowedPathPrefixes: ["/"],
 listingUrls: ["https://example.edu.br/editais"], extractionMode: "html", audienceScope: ["mixed"], geographicScope: ["Brasil"], categories: [], priority: 1, active: true };
const evidence = { source_url: "https://example.edu.br/curso", excerpt: "Inscrições abertas até 20/10/2099." };
function candidate(patch: Partial<OpportunityCandidate> = {}): OpportunityCandidate {
 return { officialSourceId: source.id, title: "Curso de pesquisa 2099", institution: "Instituto", sourcePageUrl: evidence.source_url,
 applicantType: "mixed", applicationRoute: "direct_student_application", benefitType: "other", isCourse: true, nationallyEligible: false,
 deadlineAt: "2099-10-20", deadlinePrecision: "date_only", requirementsText: "Para estudantes", amountText: "Não informado",
 stateCode: null, cityName: null, reviewStatus: "needs_information", opportunityStatus: "open", evidenceJson: { deadline_at: evidence, opportunity_status: evidence },
 extractionMethod: "html", contentHash: "initial", ...patch };
}
async function save(item = candidate()) {
 return saveReviewItems(source, { sourceId: source.id, pagesChecked: 1, discovered: [item], ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
}
function form(item: Record<string, unknown>, patch: Record<string, unknown> = {}) {
 return { ...item, categories: item.categories ?? ["formacao"], deadlineAt: String(item.deadlineAt).slice(0,10), actor: "apogee:test-admin", evidenceExcerpt: evidence.excerpt, ...patch };
}
let migrationSnapshot: unknown[] = [];
let pilotSourcesSnapshot: unknown[] = [];
let cpsRedirectPaths: string[] = [];
const extracurricularIds = [FGV_DATATHON_ID, CPS_ROBOCODE_ID, IFMG_JECT_ID, AMAZONIA_ID].sort();
let extracurricularSources: Array<{ id: string; active: boolean; verification_status: string }> = [];
let sourceMigrationReplayPreserved = false;
beforeAll(async () => {
 state.db = new PGlite({ extensions: { pgcrypto } });
 const dir = new URL("../../db/migrations/", import.meta.url);
 for (const name of (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort()) {
  if (name.startsWith("0007")) {
   await state.db.exec(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode)
    values ('legacy','Legacy','Legacy','LG','federal_institute','https://example.edu.br/','{}','{}','{}','html');
    insert into opportunities (title,institution,review_status,opportunity_status,applicant_type,application_route,benefit_type,deadline_precision,official_source_id,extraction_method,content_hash,canonical_key,requirements_text,amount_text,human_verified_at,published_at)
    values ('Legacy approved','Legacy','approved','open','mixed','direct_student_application','other','continuous_flow','legacy','html','legacy-approved','legacy-approved','','',now(),now()),
    ('Legacy pending','Legacy','pending_review','open','mixed','direct_student_application','other','continuous_flow','legacy','html','legacy-pending','legacy-pending','','',null,null);`);
  }
  await state.db.exec(await readFile(new URL(name, dir), "utf8"));
 }
 extracurricularSources = (await state.db.query<{ id: string; active: boolean; verification_status: string }>("select id,active,verification_status from official_sources where id=any($1::text[]) order by id", [extracurricularIds])).rows;
 const beforeReplay = (await state.db.query("select * from official_sources order by id")).rows;
 await state.db.exec(await readFile(new URL("0036_audited_extracurricular_editions.sql", dir), "utf8"));
 sourceMigrationReplayPreserved = JSON.stringify((await state.db.query("select * from official_sources order by id")).rows) === JSON.stringify(beforeReplay);
 cpsRedirectPaths = (await state.db.query<{allowed_path_prefixes:string[]}>("select allowed_path_prefixes from official_sources where id='cps-cultural-15-2026'")).rows[0].allowed_path_prefixes;
 migrationSnapshot = (await state.db.query("select review_status,verification_method,verified_at is not null as verified,published_at is not null as published from opportunities order by title")).rows;
 pilotSourcesSnapshot = (await state.db.query("select id,verification_status,verification_method,verification_evidence_url,audited_by from official_sources where id in ('cnpq-chamadas-abertas-2026','nasa-space-apps-2026') order by id")).rows;

 vi.stubEnv("DATABASE_EDITOR_URL", "isolated-test-only");
 vi.stubEnv("DATABASE_READER_URL", "isolated-test-only");
}, 30_000);
afterAll(async () => { await state.db?.close(); vi.unstubAllEnvs(); });
it.each([
 ["obmep-calendar-2026", "obmep-calendar-2026.html", "15 de dezembro", "16 de dezembro", "awards", "2026-12-16"],
 ["comvest-vestibular-2027", "comvest-vestibular-2027-official-news.html", "25/1/2027", "24/1/2027", "result-1", "2027-01-24"],
 ["fuvest-vestibular-2027", "fuvest-vestibular-2027-official-news.html", "26 de janeiro de 2027", "27 de janeiro de 2027", "result-1", "2027-01-27"],
])("collects/rechecks %s without duplicates, preserving edits, failures and tombstones", async (id, fixture, oldDate, newDate, stageId, expectedDate) => {
 const s = calendarAuditSource(id);
 await state.db!.exec(await readFile(new URL("../../db/migrations/0044_calendar_sources_local_validation.sql", import.meta.url), "utf8"));
 await state.db!.exec(await readFile(new URL("../../db/migrations/0045_calendar_official_alternatives.sql", import.meta.url), "utf8"));
 await state.db!.query("update official_sources set active=true,verification_status='verified' where id=$1", [s.id]);
 const html = await readFile(new URL(`./fixtures/${fixture}`, import.meta.url), "utf8");
 const respond = (body: string) => vi.mocked(fetchOfficialResource).mockResolvedValue({ body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false });
 respond(html);
 expect(await runOfficialSourceIngestion({ sourceId: s.id, maxPages: 1 })).toMatchObject({ discovered: 1 });
 const read = async () => (await state.db!.query<{id:string;discovery:{editions:{stages:{id:string;start:string}[]}[]};requirements_text:string;deleted_at:string|null}>("select id,discovery,requirements_text,deleted_at from opportunities where official_source_id=$1", [s.id])).rows;
 const original = (await read())[0];
 await runOfficialSourceIngestion({ sourceId: s.id, maxPages: 1 });
 expect(await read()).toHaveLength(1);
 await state.db!.query("update opportunities set next_source_check_at=null,management_overrides=$2,requirements_text='Curadoria preservada' where id=$1", [original.id, { requirementsText: "Curadoria preservada" }]);
 respond(html.replace(oldDate, newDate));
 expect(await recheckKnownOpportunities(s, 1, async () => "")).toMatchObject({ failed: 0, pagesChecked: 1 });
 const updated = (await read())[0];
 expect(updated.id).toBe(original.id);
 expect(updated.requirements_text).toBe("Curadoria preservada");
 expect(updated.discovery.editions[0].stages.find(s => s.id === stageId)?.start).toBe(expectedDate);
 await state.db!.query("update opportunities set next_source_check_at=null where id=$1", [original.id]);
 respond("<main>Access denied</main>");
 expect(await recheckKnownOpportunities(s, 1, async () => "")).toMatchObject({ failed: 1 });
 expect((await read())[0].discovery).toEqual(updated.discovery);
 await state.db!.query("update opportunities set deleted_at=now() where id=$1", [original.id]);
 respond(html);
 await runOfficialSourceIngestion({ sourceId: s.id, maxPages: 1 });
 expect(await read()).toHaveLength(1);
 expect((await read())[0].deleted_at).not.toBeNull();
});
it("does not duplicate a calendar already owned or deleted under another source with a different title", async () => {
 const s = calendarAuditSource("obmep-calendar-2026");
 await state.db!.exec(await readFile(new URL("../../db/migrations/0044_calendar_sources_local_validation.sql", import.meta.url), "utf8"));
 await state.db!.query("update official_sources set active=true,verification_status='verified' where id=$1", [s.id]);
 await state.db!.query("update official_sources set allowed_domains=$1,allowed_path_prefixes=$2 where id=$3", [s.allowedDomains, s.allowedPathPrefixes, source.id]);
 const legacy = { ...source, allowedDomains: s.allowedDomains, allowedPathPrefixes: s.allowedPathPrefixes };
 await saveReviewItems(legacy, { sourceId: source.id, pagesChecked: 1, discovered: [candidate({ title: "Olimpíada de Matemática — edição 2026", sourcePageUrl: s.baseUrl })], ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
 const body = await readFile(new URL("./fixtures/obmep-calendar-2026.html", import.meta.url), "utf8");
 vi.mocked(fetchOfficialResource).mockResolvedValue({ body: Buffer.from(body), contentType: "text/html", hash: "fixture", cached: false });
 expect(await runOfficialSourceIngestion({ sourceId: s.id, maxPages: 1 })).toMatchObject({ blocked: 1 });
 await state.db!.exec("update opportunities set deleted_at=now()");
 expect(await runOfficialSourceIngestion({ sourceId: s.id, maxPages: 1 })).toMatchObject({ blocked: 1 });
 expect((await state.db!.query("select count(*)::int as n from opportunities")).rows).toEqual([{ n: 1 }]);
});
it("stages the four new editions inactive and preserves every source on migration replay", () => {
 expect(extracurricularSources).toEqual(extracurricularIds.map(id => ({ id, active: false, verification_status: "verified" })));
 expect(sourceMigrationReplayPreserved).toBe(true);
});
beforeEach(async () => {
 vi.clearAllMocks();
 await state.db!.exec("truncate official_sources,opportunities,opportunity_sources,opportunity_revisions,ingestion_runs,opportunity_management_events,opportunity_alert_limits cascade");
 vi.mocked(alertMailConfiguration).mockReturnValue({dailyLimit:50} as ReturnType<typeof alertMailConfiguration>);
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status)
 values ($1,$2,$2,'IF','federal_institute',$3,$4,$5,$6,'html',$7,$8,$9,1,true,'verified')`,
 [source.id, source.name, source.baseUrl, source.allowedDomains, source.allowedPathPrefixes, source.listingUrls, source.audienceScope, source.geographicScope, []]);
});
it("publishes automatically with real RLS and the same public/admin catalogue", async () => {
 expect(await save()).toMatchObject({ saved: 1, published: 1, blocked: 0 });
 const publicItems = await listLiveCatalogue(); const adminItems = await listLiveCatalogue(true);
 expect(publicItems).toHaveLength(1); expect(adminItems).toHaveLength(1);
 expect(adminItems[0]).toMatchObject(publicItems[0]);
 expect(publicItems[0]).not.toHaveProperty("evidence"); expect(publicItems[0]).not.toHaveProperty("version");
 expect(publicItems[0]).toMatchObject({ geographicScopeKind: "unknown", countryCode: null });
 const row = (await state.db!.query("select human_verified_at,verification_method,next_source_check_at >= now() + interval '23 hours' as recheck_tomorrow from opportunities")).rows[0];
 expect(row).toEqual({ human_verified_at: null, verification_method: "automatic", recheck_tomorrow: true });
});
it.each(["ifc-integrated-technical-2027", "ifsc-technical-courses-2027", "senac-sc-psg-open-cohorts"])("mantém cursos distintos na mesma página oficial e respeita exclusões: %s", async (sourceId) => {
 const ifcSource: OfficialSource = { ...source, id: sourceId, name: "IFC",
  baseUrl: "https://ingresso.ifc.edu.br/", allowedDomains: ["ingresso.ifc.edu.br"],
  allowedPathPrefixes: ["/seletivos/"], listingUrls: ["https://ingresso.ifc.edu.br/seletivos/cursos/"] };
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status)
 values ($1,$2,$2,'IFC','federal_institute',$3,$4,$5,$6,'html',$7,$8,$9,1,true,'verified')`,
 [ifcSource.id, ifcSource.name, ifcSource.baseUrl, ifcSource.allowedDomains, ifcSource.allowedPathPrefixes, ifcSource.listingUrls, ifcSource.audienceScope, ifcSource.geographicScope, ["formacao"]]);
 const url = ifcSource.listingUrls[0];
 const proof = { source_url: url, excerpt: "Inscrições até 20/10/2099" };
 const make = (title: string, contentHash: string) => candidate({ officialSourceId: ifcSource.id,
  title, sourcePageUrl: url, contentHash, evidenceJson: { deadline_at: proof, opportunity_status: proof } });
 const ingest = (items: OpportunityCandidate[]) => saveReviewItems(ifcSource, {
  sourceId: ifcSource.id, pagesChecked: 1, discovered: items, ignored: 0, failed: 0, locationRejected: 0, warnings: [],
 });
 expect(await ingest([make("Informática — Blumenau", "one"), make("Mecatrônica — Blumenau", "two")])).toMatchObject({ created: 2, published: 2 });
 expect((await listLiveCatalogue()).map((item) => item.title).sort()).toEqual(["Informática — Blumenau", "Mecatrônica — Blumenau"]);
 expect(await ingest([make("Mecatrônica — Blumenau", "updated")])).toMatchObject({ created: 0, updated: 1 });
 const id = (await state.db!.query<{id:string}>("select id from opportunities where title='Informática — Blumenau'")).rows[0].id;
 await state.db!.query("update opportunities set deleted_at=now() where id=$1", [id]);
 expect(await ingest([make("Informática — Blumenau", "later")])).toMatchObject({ created: 0, published: 0 });
 expect((await listLiveCatalogue()).map((item) => item.title)).toEqual(["Mecatrônica — Blumenau"]);
});
it("retira PSG sem vagas em catálogo válido e preserva a ficha quando o site falha", async () => {
 const url = "https://portal.sc.senac.br/cursos-gratuitos";
 const psgSource: OfficialSource = { ...source, id: "senac-sc-psg-open-cohorts", baseUrl: url,
  allowedDomains: ["portal.sc.senac.br"], allowedPathPrefixes: ["/cursos-gratuitos"], listingUrls: [url] };
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status)
 values ($1,'PSG','Senac SC','Senac','official_reference',$2,$3,$4,$5,'html',$6,$7,$8,1,true,'verified')`,
 [psgSource.id, url, psgSource.allowedDomains, psgSource.allowedPathPrefixes, psgSource.listingUrls, ["mixed"], ["SC"], ["formacao"]]);
 const item = candidate({ officialSourceId: psgSource.id, sourcePageUrl: url,
  evidenceJson: { deadline_at: { source_url: url, excerpt: "Matrícula até 20/10/2099" }, opportunity_status: { source_url: url, excerpt: "Vagas PSG disponíveis" } } });
 const ingest = () => saveReviewItems(psgSource, { sourceId: psgSource.id, pagesChecked: 1, discovered: [item], ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
 await ingest();
 await state.db!.query("update opportunities set next_source_check_at=null where official_source_id=$1", [psgSource.id]);
 vi.mocked(fetchOfficialResource).mockResolvedValue({ body: Buffer.from('<body>Programa Senac de Gratuidade 100% GRATUITO PSG renda familiar mensal per capita de até 2 salários mínimos<script>window.cursosData = [];</script></body>'), contentType: "text/html", hash: "valid-empty", cached: false });
 expect(await recheckKnownOpportunities(psgSource, 200, async () => "")).toMatchObject({ pagesChecked: 1, failed: 0 });
 expect(await listLiveCatalogue()).toHaveLength(0);
 await ingest();
 await state.db!.query("update opportunities set next_source_check_at=null where official_source_id=$1", [psgSource.id]);
 vi.mocked(fetchOfficialResource).mockResolvedValue({ body: Buffer.from('<body>Manutenção</body>'), contentType: "text/html", hash: "unavailable", cached: false });
 expect(await recheckKnownOpportunities(psgSource, 200, async () => "")).toMatchObject({ pagesChecked: 1, failed: 1 });
 expect(await listLiveCatalogue()).toHaveLength(1);
});
it("preserves global eligibility without inventing country, state or city", async () => {
 await save(candidate({ geographicScopeKind: "global", countryCode: null }));
 expect((await listLiveCatalogue())[0]).toMatchObject({ geographicScopeKind: "global", countryCode: null, stateCode: null, cityName: null });
 await expect(state.db!.exec("update opportunities set country_code='BR' where geographic_scope_kind='global'")).rejects.toThrow();
});
it("classifies structured evidence in several categories and preserves an administrator edit on recrawl", async () => {
 await save(candidate({ benefitType: "research_scholarship", isCourse: true }));
 const [item] = await listLiveCatalogue(true);
 expect(item.categories).toEqual(["formacao", "bolsas", "pesquisa"]);
 await manageCatalogue("PATCH", form(item, { categories: ["pesquisa", "eventos"] }));
 await save(candidate({ benefitType: "research_scholarship", isCourse: true, contentHash: "recrawl" }));
 expect((await listLiveCatalogue())[0].categories).toEqual(["pesquisa", "eventos"]);
 expect((await listLiveCatalogue(true))[0].categories).toEqual(["pesquisa", "eventos"]);
 await expect(manageCatalogue("PATCH", form((await listLiveCatalogue(true))[0], { categories: ["invented"] }))).rejects.toThrow("categoria válida");
});
it("schedules rechecks of assisted imports without crawling empty manual sources or deleted records", async () => {
 await state.db!.exec("update official_sources set extraction_mode='manual_assisted'");
 expect(await claimDueOfficialSources(3)).toEqual([]);
 await save(candidate({ opportunityStatus: "unknown", extractionMethod: "manual_assisted" }));
 expect(await listLiveCatalogue()).toEqual([]);
 expect((await claimDueOfficialSources(3)).map((item) => item.id)).toEqual([source.id]);
 expect(await claimDueOfficialSources(3)).toEqual([]); // lease prevents concurrent work
 await completeScheduledSource(source.id, false);
 await state.db!.exec("update official_sources set next_crawl_at=null; update opportunities set next_source_check_at=now()+interval '1 day'");
 expect(await claimDueOfficialSources(3)).toEqual([]);
 await state.db!.exec("update opportunities set next_source_check_at=null,deleted_at=now()");
 expect(await claimDueOfficialSources(3)).toEqual([]);
});
it("requires a recorded official review before leasing a discovery page", async () => {
 await withAdminTransaction((client) => client.query(
  `insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url)
   values ('cnpq-chamadas-abertas','CNPq','CNPq','site','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas')`,
 ));
 expect(await claimDueDiscoveryTargets(2)).toEqual([]);
 await expect(state.db!.exec("update discovery_targets set enabled=true where id='cnpq-chamadas-abertas'")).rejects.toThrow();
 await expect(state.db!.exec(`update discovery_targets set official_verified_at=now(),
   official_verified_by='test-admin',official_review_note='Official CNPq page reviewed',enabled=true
   where id='cnpq-chamadas-abertas'`)).rejects.toThrow();
 await withAdminTransaction((client) => client.query(
  `update discovery_targets set official_verified_at=now(),official_verified_url=official_url,
    official_verified_by='test-admin',official_review_note='Official CNPq page reviewed',enabled=true
   where id='cnpq-chamadas-abertas'`,
 ));
 expect((await claimDueDiscoveryTargets(2)).map((item) => item.id)).toEqual(["cnpq-chamadas-abertas"]);
 expect(await claimDueDiscoveryTargets(2)).toEqual([]);
 await completeDiscoveryTarget("cnpq-chamadas-abertas", "checked");
 const row = (await state.db!.query<{ next_day: boolean }>(
  "select next_check_at >= now() + interval '23 hours' as next_day from discovery_targets where id='cnpq-chamadas-abertas'",
 )).rows[0];
 expect(row.next_day).toBe(true);
 await expect(state.db!.exec("update discovery_targets set official_url='https://other.example.org/' where id='cnpq-chamadas-abertas'")).rejects.toThrow();
});
it("refreshes unchanged content without duplicating and applies a retification with history", async () => {
 await save(); const [first] = await listLiveCatalogue(true);
 await state.db!.exec("update opportunities set last_source_check_at=now()-interval '2 days'");
 expect(await save()).toMatchObject({ saved: 0, published: 0 });
 let [next] = await listLiveCatalogue(true); expect(next.id).toBe(first.id); expect(next.version).toBe(first.version);
 expect(Date.parse(next.lastCheckedAt)).toBeGreaterThan(Date.now()-60_000);
 await save(candidate({ contentHash: "retification", deadlineAt: "2099-11-30", hasRetification: true }));
 [next] = await listLiveCatalogue(true); expect(next.id).toBe(first.id); expect(next.deadlineAt).toContain("2099-11-30");
 expect((await state.db!.query("select * from opportunity_management_events")).rows).toHaveLength(2);
});
it("preserves only edited fields during subsequent source updates", async () => {
 await save(); const [initial] = await listLiveCatalogue(true);
 await manageCatalogue("PATCH", form(initial, { title: "Título administrado", amountText: "Apoio corrigido" }));
 await save(candidate({ contentHash: "new-source-content", requirementsText: "Requisito novo", deadlineAt: "2099-11-30" }));
 const [updated] = await listLiveCatalogue(true);
 expect(updated).toMatchObject({ id: initial.id, title: "Título administrado", amountText: "Apoio corrigido", requirementsText: "Requisito novo" });
 expect(updated.deadlineAt).toContain("2099-11-30");
});
it("deletion survives a later crawl and cannot be recreated by the create endpoint", async () => {
 await save(); const [item] = await listLiveCatalogue(true);
 await manageCatalogue("DELETE", { id: item.id, version: item.version, actor: "apogee:admin" });
 await save(candidate({ contentHash: "changed-after-deletion", title: "Novo título na mesma página" }));
 expect(await listLiveCatalogue()).toEqual([]); expect(await listLiveCatalogue(true)).toEqual([]);
 await expect(manageCatalogue("POST", form(item))).rejects.toThrow("já existe");
 expect((await state.db!.query("select * from opportunities")).rows).toHaveLength(1);
});
it("rejects stale versions atomically and creates valid manual records immediately", async () => {
 const input = { ...candidate(), categories: ["formacao"], officialUrl: evidence.source_url, actor: "apogee:admin", evidenceExcerpt: evidence.excerpt };
 await manageCatalogue("POST", input);
 const [item] = await listLiveCatalogue(true); expect(item.verificationMethod).toBe("admin");
 await manageCatalogue("PATCH", form(item, { title: "Primeira edição" }));
 await expect(manageCatalogue("PATCH", form(item, { title: "Edição atrasada" }))).rejects.toThrow("Recarregue");
 expect((await listLiveCatalogue())[0].title).toBe("Primeira edição");
});
it("automatically withdraws invalid status, conflict, expired deadline or missing evidence", async () => {
 for (const patch of [{ opportunityStatus: "unknown" }, { opportunityStatus: "closed" }, { opportunityStatus: "suspended" }, { sourceConflict: true }, { deadlineAt: "2020-01-01" }, { evidenceJson: {} }] as Partial<OpportunityCandidate>[]) {
  await save(candidate({ ...patch, contentHash: JSON.stringify(patch) })); expect(await listLiveCatalogue()).toEqual([]);
 }
 await save(candidate({ contentHash: "restored", opportunityStatus: "upcoming" }));
 expect((await listLiveCatalogue())[0].opportunityStatus).toBe("upcoming");
 await state.db!.exec("update official_sources set active=false");
 expect(await listLiveCatalogue()).toEqual([]); expect(await listLiveCatalogue(true)).toEqual([]);
});
it("source closure overrides an earlier manual open status", async () => {
 await manageCatalogue("POST", { ...candidate(), categories: ["formacao"], officialUrl: evidence.source_url, actor: "apogee:admin", evidenceExcerpt: evidence.excerpt });
 await save(candidate({ opportunityStatus: "closed", contentHash: "closed" }));
 expect(await listLiveCatalogue()).toEqual([]);
});
it("rechecks existing pages, withdraws unconfirmed items and never refreshes verification after a network error", async () => {
 await save(); const [item] = await listLiveCatalogue(true);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockRejectedValueOnce(new Error("timeout"));
 expect(await recheckKnownOpportunities(source, 2, async () => "")).toMatchObject({ failed: 1 });
 expect((await listLiveCatalogue())[0].lastCheckedAt).toBe(item.lastCheckedAt);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockResolvedValueOnce({ body: Buffer.from("no longer an opportunity"), contentType: "text/html", hash: "changed", cached: false });
 await recheckKnownOpportunities(source, 2, async () => "Inscrições encerradas");
 expect(await listLiveCatalogue()).toEqual([]);
});

it("withdraws the MinC exchange call when it leaves the official open-call index", async () => {
 const url = "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/edital-de-intercambio-cultural-circulacao-e-participacao-audiovisual-no-exterior";
 const listingUrl = "https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento";
 const minc: OfficialSource = {
  ...source, id: "minc-intercambio-audiovisual-2026", institutionName: "Ministério da Cultura",
  baseUrl: listingUrl, allowedDomains: ["www.gov.br"], allowedPathPrefixes: ["/cultura/pt-br/assuntos/editais/inscricoes-em-andamento"],
  listingUrls: [listingUrl], geographicScope: ["Brasil"],
 };
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status)
 values ($1,$2,$3,'MinC','federal_government',$4,$5,$6,$7,'html',$8,$9,$10,80,true,'verified')`,
 [minc.id, minc.name, minc.institutionName, minc.baseUrl, minc.allowedDomains, minc.allowedPathPrefixes, minc.listingUrls, minc.audienceScope, minc.geographicScope, minc.categories]);
 const proof = { source_url: url, excerpt: "Inscrições abertas até 20/10/2099." };
 const item = candidate({ officialSourceId: minc.id, sourcePageUrl: url, evidenceJson: { deadline_at: proof, opportunity_status: proof } });
 await saveReviewItems(minc, { sourceId: minc.id, pagesChecked: 1, discovered: [item], ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
 expect(await listLiveCatalogue()).toHaveLength(1);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockRejectedValueOnce(new Error("timeout"));
 expect(await recheckKnownOpportunities(minc, 1, async () => "")).toMatchObject({ failed: 1 });
 expect(await listLiveCatalogue()).toHaveLength(1);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockResolvedValueOnce({ body: Buffer.from("<h1>Editais em andamento</h1>"), contentType: "text/html", hash: "incomplete", cached: false });
 expect(await recheckKnownOpportunities(minc, 1, async () => "")).toMatchObject({ failed: 1 });
 expect(await listLiveCatalogue()).toHaveLength(1);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockResolvedValueOnce({ body: Buffer.from("<h1>Editais em andamento</h1><a href='/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/outra-chamada'>Outra chamada</a>"), contentType: "text/html", hash: "listing", cached: false });
 expect(await recheckKnownOpportunities(minc, 1, async () => "")).toMatchObject({ pagesChecked: 1, failed: 0 });
 expect(vi.mocked(fetchOfficialResource).mock.calls.at(-1)?.[0]).toBe(listingUrl);
 expect(await listLiveCatalogue()).toEqual([]);
});

it("publishes a FAPESP direct application and withdraws it when the official open list removes it", async () => {
 const listingUrl = "https://fapesp.br/oportunidades/";
 const url = "https://fapesp.br/oportunidades/projeto-de-logica/9715/";
 const fapesp: OfficialSource = {
  ...source, id: "fapesp-open-fellowships", institutionName: "FAPESP", sourceType: "government_foundation",
  baseUrl: listingUrl, allowedDomains: ["fapesp.br", "www.fapesp.br"],
  allowedPathPrefixes: ["/oportunidades/"], listingUrls: [listingUrl], geographicScope: [],
 };
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status)
 values ($1,$2,$3,'FAPESP','government_foundation',$4,$5,$6,$7,'html',$8,$9,$10,95,true,'verified')`,
 [fapesp.id, fapesp.name, fapesp.institutionName, fapesp.baseUrl, fapesp.allowedDomains, fapesp.allowedPathPrefixes, fapesp.listingUrls, fapesp.audienceScope, fapesp.geographicScope, ["bolsas", "pesquisa"]]);
 const proof = { source_url: url, excerpt: "Data limite para inscrições: 20/10/2099" };
 const item = candidate({ officialSourceId: fapesp.id, sourcePageUrl: url, applicationRoute: "direct_application",
  categories: ["bolsas", "pesquisa"], benefitType: "research_scholarship", isCourse: false,
  evidenceJson: { deadline_at: proof, opportunity_status: proof, application_route: proof } });
 await saveReviewItems(fapesp, { sourceId: fapesp.id, pagesChecked: 1, discovered: [item], ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
 expect((await listLiveCatalogue())[0]).toMatchObject({ categories: ["bolsas", "pesquisa"] });
 expect((await state.db!.query("select application_route from opportunities where official_source_id=$1", [fapesp.id])).rows[0]).toEqual({ application_route: "direct_application" });
 const secondUrl = "https://fapesp.br/oportunidades/outro-projeto/9716/";
 await saveReviewItems(fapesp, { sourceId: fapesp.id, pagesChecked: 1,
  discovered: [{ ...item, sourcePageUrl: secondUrl, contentHash: "different-project",
   evidenceJson: { deadline_at: { source_url: secondUrl, excerpt: proof.excerpt },
    opportunity_status: { source_url: secondUrl, excerpt: proof.excerpt } } }],
  ignored: 0, failed: 0, locationRejected: 0, warnings: [] });
 expect((await listLiveCatalogue())).toHaveLength(2); // Same short title, distinct FAPESP posting IDs.
 expect((await state.db!.query("select distinct canonical_key from opportunities where official_source_id=$1", [fapesp.id])).rows).toHaveLength(2);
 await state.db!.query("update opportunities set deleted_at=now(),published_at=null where content_hash='different-project'");
 expect(await listLiveCatalogue(true)).toHaveLength(1);
 await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 day'");
 vi.mocked(fetchOfficialResource).mockResolvedValueOnce({ body: Buffer.from("<h1>Oportunidades de Bolsas</h1><a href='/oportunidades/outro-projeto/9999/'>Outra bolsa aberta</a>"), contentType: "text/html", hash: "listing", cached: false });
 expect(await recheckKnownOpportunities(fapesp, 1, async () => "")).toMatchObject({ pagesChecked: 1, failed: 0 });
 expect(await listLiveCatalogue()).toEqual([]);
});

it("migration retains verified publications and does not promote legacy pending records", () => {
 expect(migrationSnapshot).toEqual([
  { review_status: "approved", verification_method: "admin", verified: true, published: true },
  { review_status: "pending_review", verification_method: null, verified: false, published: false },
 ]);
});
it("records agent source verification separately from human audit", () => {
 expect(pilotSourcesSnapshot).toEqual([
  { id: "cnpq-chamadas-abertas-2026", verification_status: "verified", verification_method: "operator_authorized_agent", verification_evidence_url: "https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas", audited_by: null },
  { id: "nasa-space-apps-2026", verification_status: "verified", verification_method: "operator_authorized_agent", verification_evidence_url: "https://www.spaceappschallenge.org/2026/", audited_by: null },
 ]);
});

it("keeps distinct manually entered programmes on one page separate", async () => {
 const input = { ...candidate(), categories: ["formacao"], officialUrl: evidence.source_url, actor: "apogee:admin", evidenceExcerpt: evidence.excerpt };
 await manageCatalogue("POST", input);
 await manageCatalogue("POST", { ...input, title: "Outro programa na mesma página" });
 expect(await listLiveCatalogue()).toHaveLength(2);
 await expect(save(candidate({ title: "Título ambíguo", contentHash: "ambiguous" }))).rejects.toThrow("ambígua");
 expect(await listLiveCatalogue()).toHaveLength(2);
});
it("preserves former URLs as aliases and does not recertify an administrator URL with an old crawl", async () => {
 await save(); const [item] = await listLiveCatalogue(true);
 await manageCatalogue("PATCH", form(item, { officialUrl: "https://example.edu.br/novo" }));
 const [edited] = await listLiveCatalogue(true);
 expect(edited.officialUrl).toBe("https://example.edu.br/novo");
 await save(candidate({ contentHash: "old-url-changed" }));
 expect((await listLiveCatalogue(true))[0].version).toBe(edited.version);
 await manageCatalogue("DELETE", { id: edited.id, version: edited.version, actor: "apogee:admin" });
 await save(candidate({ title: "Título novo no endereço antigo", contentHash: "new-title" }));
 expect(await listLiveCatalogue()).toEqual([]);
 expect((await state.db!.query("select * from opportunities")).rows).toHaveLength(1);
});

it("persists event start precision through admin edits, the bridge and subsequent crawls", async () => {
 await save();
 let [item] = await listLiveCatalogue(true);
 await manageCatalogue("PATCH", form(item, { categories: ["eventos"], eventStartsAt: "2099-10-14" }));
 expect((await listLiveCatalogue())[0].eventStartsAt).toBe("2099-10-14");
 await save(candidate({ contentHash: "recrawl-event" }));
 [item] = await listLiveCatalogue(true);
 expect(item.eventStartsAt).toBe("2099-10-14");
 await manageCatalogue("PATCH", form(item, { eventStartsAt: "2099-10-14T09:00:00-03:00" }));
 [item] = await listLiveCatalogue(true);
 expect(item.eventStartsAt).toBe("2099-10-14T09:00:00-03:00");
 await expect(manageCatalogue("PATCH", form(item, { eventStartsAt: "2099-02-30" }))).rejects.toThrow("inválida");
 await expect(manageCatalogue("PATCH", form(item, { categories: ["bolsas"] }))).rejects.toThrow("categoria Eventos");
 await manageCatalogue("PATCH", form(item, { eventStartsAt: "" }));
 await save(candidate({ contentHash: "recrawl-cleared-event" }));
 expect((await listLiveCatalogue())[0].eventStartsAt).toBeNull();
});

function openEvent(patch:Partial<OpportunityCandidate>={}) {
 return candidate({isCourse:false,categories:["eventos"],deadlineAt:undefined,deadlinePrecision:"not_informed",eventStartsAt:"2099-10-20T19:00:00-03:00",
  evidenceJson:{opportunity_status:evidence,event_start:evidence,registration_availability:evidence},...patch});
}
async function eventSubscription() {
 await save(openEvent()); const item=(await listLiveCatalogue())[0];
 await subscribeToOpportunity({opportunityId:item.id,email:"Student@Example.test",consent:true});
 const job=(await state.db!.query<{payload:{text:string}}>("select payload from opportunity_alert_outbox")).rows[0];
 const confirm=/acao=confirmar&token=([a-f0-9]{64})/.exec(job.payload.text)![1];
 const unsubscribe=/acao=cancelar&token=([a-f0-9]{64})/.exec(job.payload.text)![1];
 return {item,confirm,unsubscribe};
}
it("publica somente eventos abertos sem prazo com evidência e os retira no início",async()=>{
 expect(await save(openEvent())).toMatchObject({published:1});
 expect((await listLiveCatalogue())[0]).toMatchObject({deadlineAt:null,deadlinePrecision:"not_informed",eventStartsAt:"2099-10-20T19:00:00-03:00"});
 expect((await listLiveCatalogue(true))[0]).toMatchObject((await listLiveCatalogue())[0]);
 await state.db!.query("update opportunities set event_starts_at='2000-01-01T09:00:00-03:00'");
 expect(await listLiveCatalogue()).toEqual([]);expect(await listLiveCatalogue(true)).toEqual([]);
 await state.db!.query("update opportunities set event_starts_at='2099-10-20',evidence_json='{}'");
 expect(await listLiveCatalogue()).toEqual([]);
});
it("não libera programas sem prazo, evento sem início, inscrições futuras ou prova ausente",async()=>{
 for(const patch of [{categories:["carreira"]},{eventStartsAt:null},{opportunityStatus:"upcoming"},{evidenceJson:{event_start:evidence,opportunity_status:evidence}}] as Partial<OpportunityCandidate>[]) {
  expect(await save(openEvent(patch))).toMatchObject({published:0});
 }
 expect(await listLiveCatalogue()).toEqual([]);
});
it("exige consentimento e confirmação, não envia ao público e respeita cancelamento",async()=>{
 await save(openEvent());const id=(await listLiveCatalogue())[0].id;
 await expect(subscribeToOpportunity({opportunityId:id,email:"bad\r\nBcc: other@example.test",consent:true})).rejects.toThrow("válido");
 await expect(subscribeToOpportunity({opportunityId:id,email:"student@example.test",consent:false})).rejects.toThrow("Confirme");
 const {confirm,unsubscribe}=await eventSubscription();
 expect(await queueOpportunityChanges()).toBe(0);
 const hidden=await withAdminTransaction(async(client)=>{
  await client.query("select set_config('app.is_admin','false',true)");
  return Promise.all([client.query("select * from opportunity_alert_subscriptions"),client.query("select * from opportunity_alert_outbox"),client.query("select * from opportunity_alert_limits")]);
 });expect(hidden.every(result=>result.rows.length===0)).toBe(true);
 await updateAlertSubscription("confirm",confirm);
 await updateAlertSubscription("confirm",confirm);
 await save(openEvent({deadlineAt:"2099-10-18",deadlinePrecision:"date_only",contentHash:"new-deadline",evidenceJson:{deadline_at:evidence,opportunity_status:evidence,event_start:evidence,registration_availability:evidence}}));
 expect(await queueOpportunityChanges()).toBe(1);expect(await queueOpportunityChanges()).toBe(0);
 await updateAlertSubscription("unsubscribe",unsubscribe);
 expect(await runOpportunityAlerts()).toMatchObject({sent:0});expect(sendAlertMail).not.toHaveBeenCalled();
});
it("avisa alterações e início uma vez, mas não a repetição da consulta diária",async()=>{
 const {confirm}=await eventSubscription();await updateAlertSubscription("confirm",confirm);
 await save(openEvent({contentHash:"daily-recheck"}));expect(await queueOpportunityChanges()).toBe(0);
 await save(openEvent({amountText:"Participação gratuita",contentHash:"updated"}));
 expect(await runOpportunityAlerts()).toMatchObject({queued:1,sent:1,failed:0});
 expect(await runOpportunityAlerts()).toMatchObject({queued:0,sent:0});expect(sendAlertMail).toHaveBeenCalledTimes(1);
 await state.db!.query("update opportunities set event_starts_at='2000-01-01T09:00:00-03:00'");
 expect(await runOpportunityAlerts()).toMatchObject({queued:1,sent:1});
 expect(await runOpportunityAlerts()).toMatchObject({queued:0,sent:0});
 expect((await state.db!.query("select status from opportunity_alert_subscriptions")).rows[0]).toMatchObject({status:"completed"});
});
it("aceita acompanhamento com prazo e preserva mudanças anteriores à confirmação",async()=>{
 await save(); const id=(await listLiveCatalogue())[0].id;
 await subscribeToOpportunity({opportunityId:id,email:"student@example.test",consent:true});
 const job=(await state.db!.query<{payload:{text:string}}>("select payload from opportunity_alert_outbox")).rows[0];
 const confirm=/acao=confirmar&token=([a-f0-9]{64})/.exec(job.payload.text)![1];
 await save(candidate({deadlineAt:"2099-10-21",contentHash:"updated-before-confirmation"}));
 await updateAlertSubscription("confirm",confirm);
 expect(await queueOpportunityChanges()).toBe(1);
 const notice=(await state.db!.query<{payload:{text:string}}>("select payload from opportunity_alert_outbox where kind='change'")).rows[0].payload.text;
 expect(notice).toContain("20/10/2099 → 21/10/2099");
 expect(notice).toContain(`/oportunidades/oportunidade--radar-${id}`);
 expect(await queueOpportunityChanges()).toBe(0);
 expect(sendAlertMail).not.toHaveBeenCalled();
});
it("o scheduler da fonte respeita a reconsulta NASA de seis horas",async()=>{
 await completeScheduledSource(source.id,false);
 expect((await state.db!.query("select next_crawl_at >= now()+interval '23 hours' as daily from official_sources where id=$1",[source.id])).rows[0]).toEqual({daily:true});
 const s={...source,id:"nasa-space-apps-2026"};
 await state.db!.query("update official_sources set id=$1,crawl_interval_hours=24 where id=$2",[s.id,source.id]);
 await saveReviewItems(s,{sourceId:s.id,pagesChecked:1,discovered:[candidate({officialSourceId:s.id})],ignored:0,failed:0,locationRejected:0,warnings:[]});
 await completeScheduledSource(s.id,false);
 expect((await state.db!.query("select next_crawl_at between now()+interval '5 hours 59 minutes' and now()+interval '6 hours 1 minute' as six_hours from official_sources where id=$1",[s.id])).rows[0]).toEqual({six_hours:true});
 expect(await claimDueOfficialSources(1)).toEqual([]);
 await state.db!.query("update official_sources set next_crawl_at=now()-interval '1 second' where id=$1",[s.id]);
 expect((await claimDueOfficialSources(1)).map(s=>s.id)).toEqual([s.id]);
});
it("não anuncia retirada por extração inconclusiva, preservando o acompanhamento",async()=>{
 const {confirm}=await eventSubscription();await updateAlertSubscription("confirm",confirm);
 await state.db!.exec("update opportunities set next_source_check_at=null");
 vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from("changed-page"),contentType:"text/html",hash:"inconclusive",cached:false});
 await recheckKnownOpportunities(source,1,async()=>"Página temporariamente incompleta.");
 expect(await queueOpportunityChanges()).toBe(0);
 expect((await state.db!.query("select status from opportunity_alert_subscriptions")).rows[0]).toEqual({status:"active"});
 await save(openEvent());
 expect(await queueOpportunityChanges()).toBe(0);
});
it("avisa mudança no término de etapa, ignorando apenas a nova conferência",async()=>{
 const discovery = (end:string,checkedAt:string):NonNullable<OpportunityCandidate["discovery"]> => ({areas:[],editions:[{id:"edition",name:"Edição",stages:[
  {id:"event",name:"Hackathon",kind:"event",start:"2099-10-20",end,sourceUrl:evidence.source_url,checkedAt},
 ]}]});
 const {confirm}=await eventSubscription();
 await save(openEvent({discovery:discovery("2099-10-21","2026-10-01T12:00:00Z")}));
 await updateAlertSubscription("confirm",confirm);
 expect(await queueOpportunityChanges()).toBe(1);
 const before=(await state.db!.query<{version:number}>("select version from opportunities")).rows[0].version;
 expect(await save(openEvent({discovery:discovery("2099-10-21","2026-10-02T12:00:00Z")}))).toMatchObject({updated:0});
 expect((await state.db!.query<{version:number}>("select version from opportunities")).rows[0].version).toBe(before);
 expect(await queueOpportunityChanges()).toBe(0);
 await save(openEvent({discovery:discovery("2099-10-22","2026-10-03T12:00:00Z")}));
 expect(await queueOpportunityChanges()).toBe(1);
 expect((await state.db!.query<{payload:{text:string}}>("select payload from opportunity_alert_outbox where kind='change' order by created_at desc limit 1")).rows[0].payload.text).toContain("22/10/2099");
 expect(await queueOpportunityChanges()).toBe(0);
});
it("limita tentativas de Resend por dia, persiste falhas e expira confirmação",async()=>{
 const {confirm}=await eventSubscription();
 await state.db!.query("update opportunity_alert_subscriptions set confirm_expires_at=now()-interval '1 second'");
 await expect(updateAlertSubscription("confirm",confirm)).rejects.toThrow("expirado");
 expect(await runOpportunityAlerts()).toMatchObject({sent:0});
 await state.db!.query("update opportunity_alert_subscriptions set confirm_expires_at=now()+interval '24 hours'");
 vi.mocked(alertMailConfiguration).mockReturnValue({dailyLimit:1} as ReturnType<typeof alertMailConfiguration>);
 vi.mocked(sendAlertMail).mockRejectedValueOnce(new Error("Resend temporary failure"));
 expect(await runOpportunityAlerts()).toMatchObject({sent:0,failed:1});
 await state.db!.query("update opportunity_alert_outbox set next_attempt_at=now()-interval '1 second'");
 expect(await runOpportunityAlerts()).toMatchObject({sent:0,failed:0});
 expect((await state.db!.query("select status,attempts from opportunity_alert_outbox")).rows[0]).toMatchObject({status:"pending",attempts:1});
});
it("encerra o acompanhamento após encerramento confirmado, sem enviar novamente na rechecagem",async()=>{
 const {confirm}=await eventSubscription();await updateAlertSubscription("confirm",confirm);
 await state.db!.exec("update opportunities set next_source_check_at=null");
 vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from("official"),contentType:"text/html",hash:"closed",cached:false});
 await recheckKnownOpportunities(source,1,async()=>"Inscrições encerradas para o evento.");
 expect((await state.db!.query("select opportunity_status from opportunities")).rows[0]).toEqual({opportunity_status:"closed"});
 expect(await queueOpportunityChanges()).toBe(1);
 expect((await state.db!.query("select status from opportunity_alert_subscriptions")).rows[0]).toEqual({status:"completed"});
 expect(await queueOpportunityChanges()).toBe(0);expect(sendAlertMail).not.toHaveBeenCalled();
});
it("aplica retenção dos dados pessoais quando o envio está desativado",async()=>{
 await eventSubscription();
 await state.db!.exec("update opportunity_alert_subscriptions set confirm_expires_at=now()-interval '8 days'");
 vi.mocked(alertMailConfiguration).mockReturnValue(null);
 expect(await runOpportunityAlerts()).toMatchObject({enabled:false,sent:0});
 expect((await state.db!.query("select count(*)::int as total from opportunity_alert_subscriptions")).rows[0]).toEqual({total:0});
 expect((await state.db!.query("select count(*)::int as total from opportunity_alert_outbox")).rows[0]).toEqual({total:0});
 expect(sendAlertMail).not.toHaveBeenCalled();
});
it("finaliza assinante ativo quando o evento começa com envio desativado, e depois aplica retenção",async()=>{
 const {confirm}=await eventSubscription();await updateAlertSubscription("confirm",confirm);
 await state.db!.exec("update opportunities set event_starts_at='2000-01-01'");
 vi.mocked(alertMailConfiguration).mockReturnValue(null);
 expect(await runOpportunityAlerts()).toMatchObject({enabled:false,sent:0,queued:1});
 expect((await state.db!.query("select status from opportunity_alert_subscriptions")).rows[0]).toEqual({status:"completed"});
 await state.db!.exec("update opportunity_alert_subscriptions set updated_at=now()-interval '31 days'");
 await runOpportunityAlerts();
 expect((await state.db!.query("select count(*)::int as total from opportunity_alert_subscriptions")).rows[0]).toEqual({total:0});
 expect(sendAlertMail).not.toHaveBeenCalled();
});
it("persiste cancelamento explícito mesmo se o texto mantém a chamada anterior e edição administrativa",async()=>{
 const {confirm}=await eventSubscription();await updateAlertSubscription("confirm",confirm);
 await state.db!.exec("update opportunities set next_source_check_at=null,management_overrides='{\"opportunityStatus\":\"open\"}'");
 vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from("official"),contentType:"text/html",hash:"cancelled",cached:false});
 await recheckKnownOpportunities(source,1,async()=>"Inscrições abertas em fluxo contínuo pelo formulário de inscrição. As inscrições foram canceladas.");
 expect((await state.db!.query("select opportunity_status from opportunities")).rows[0]).toEqual({opportunity_status:"cancelled"});
 expect(await queueOpportunityChanges()).toBe(1);
 expect((await state.db!.query("select status from opportunity_alert_subscriptions")).rows[0]).toEqual({status:"completed"});
 expect(sendAlertMail).not.toHaveBeenCalled();
});
it("não duplica nem ressuscita uma edição encontrada por outra fonte oficial na mesma página",async()=>{
 await save();const first=(await listLiveCatalogue(true))[0];
 const other={...source,id:"overlapping-source"};
 await state.db!.exec("insert into official_sources select (jsonb_populate_record(null::official_sources,to_jsonb(s)||'{\"id\":\"overlapping-source\"}'::jsonb)).* from official_sources s where id='test-source'");
 const ingest=()=>saveReviewItems(other,{sourceId:other.id,pagesChecked:1,discovered:[candidate({officialSourceId:other.id,contentHash:"overlap"})],ignored:0,failed:0,locationRejected:0,warnings:[]});
 expect(await ingest()).toMatchObject({created:0,published:0});expect(await listLiveCatalogue()).toHaveLength(1);
 await manageCatalogue("DELETE",{id:first.id,version:first.version,actor:"test-admin"});
 expect(await ingest()).toMatchObject({created:0,published:0});expect(await listLiveCatalogue()).toHaveLength(0);
});

it("continues listing-page progress in five minutes and returns to daily cadence after the complete cycle", async () => {
 await state.db!.exec("update official_sources set crawl_listing_index=1,crawl_link_offset=0");
 await completeScheduledSource(source.id, false);
 expect((await state.db!.query("select next_crawl_at < now()+interval '6 minutes' as continuing from official_sources where id=$1",[source.id])).rows[0]).toEqual({continuing:true});
 await state.db!.exec("update official_sources set crawl_listing_index=0,crawl_link_offset=0");
 await completeScheduledSource(source.id, false);
 expect((await state.db!.query("select next_crawl_at >= now()+interval '23 hours' as daily from official_sources where id=$1",[source.id])).rows[0]).toEqual({daily:true});
});

it("rechecks an actual EV.G course through RLS, preserving edits and withdrawing missing enrollment", async () => {
 const { normalizeEvgCourse, normalizeEvgPolicy } = await import("@/lib/ingestion/normalize-evg-courses");
 const evg: OfficialSource = { ...source,id:"evg-enap-open-courses",name:"EV.G",baseUrl:"https://www.escolavirtual.gov.br/catalogo",allowedDomains:["www.escolavirtual.gov.br"],allowedPathPrefixes:["/catalogo","/curso/","/perguntas-frequentes"],listingUrls:["https://www.escolavirtual.gov.br/catalogo"] };
 await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status) values ($1,'EV.G','Enap','Enap','government_foundation',$2,$3,$4,$5,'html',true,'verified')`,[evg.id,evg.baseUrl,evg.allowedDomains,evg.allowedPathPrefixes,evg.listingUrls]);
 const html=await readFile(new URL("./fixtures/evg-course-1604.html",import.meta.url),"utf8");
 const policy=normalizeEvgPolicy("<body>Todos os cursos da Escola Virtual de Governo (EV.G) são de autoinstrução, sem tutoria, com certificado e gratuitos.</body>");
 const item=normalizeEvgCourse(html,"https://www.escolavirtual.gov.br/curso/1604",evg,policy)!;
 const ingest=(candidate:OpportunityCandidate)=>saveReviewItems(evg,{sourceId:evg.id,pagesChecked:3,discovered:[candidate],ignored:0,failed:0,locationRejected:0,warnings:[]});
 expect(await ingest(item)).toMatchObject({created:1,published:1});
 const [original]=await listLiveCatalogue(true);
 expect(original.applicationUrl).toBe(item.applicationUrl);
 await manageCatalogue("PATCH",form(original,{title:"Ativos Virtuais — edição administrativa",deadlineAt:null,evidenceExcerpt:item.evidenceJson.opportunity_status.excerpt}));
 expect((await listLiveCatalogue())[0].applicationUrl).toBe(item.applicationUrl);
 const alias={...item,sourcePageUrl:"https://www.escolavirtual.gov.br/curso/9999",contentHash:"same-programme-other-url"};
 expect(await ingest(alias)).toMatchObject({created:0});expect(await listLiveCatalogue()).toHaveLength(1);
 expect((await listLiveCatalogue())[0].title).toBe("Ativos Virtuais — edição administrativa");
 await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
 vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(html.replace(/>\s*Inscreva-se\s*</g,">Matrícula indisponível<")),contentType:"text/html",hash:"no-enrollment",cached:false});
 expect(await recheckKnownOpportunities(evg,6,async()=>"",policy)).toMatchObject({pagesChecked:1,failed:0});
 expect(await listLiveCatalogue()).toHaveLength(0);
 expect(await ingest(item)).toMatchObject({created:0,published:1});
 await state.db!.query("update opportunities set deleted_at=now() where id=$1",[original.id]);
 expect(await ingest(alias)).toMatchObject({created:0,published:0});expect(await listLiveCatalogue()).toHaveLength(0);
});

it("rechecks the Fulbright selection through RLS, preserves edits and withdraws missing application", async () => {
 const { normalizeFulbright, FULBRIGHT_URL } = await import("@/lib/ingestion/normalize-fulbright");
 const { fulbrightSource: fb, fulbrightHtml: html } = await import("./fixtures/fulbright");
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-14T23:35:00Z"));
 try {
  await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status) values ($1,'Fulbright','Fulbright','FB','official_reference',$2,$3,$4,$5,'html',true,'verified')`,[fb.id,fb.baseUrl,fb.allowedDomains,fb.allowedPathPrefixes,fb.listingUrls]);
  const item=normalizeFulbright(html,FULBRIGHT_URL,fb)!;
  const ingest=()=>saveReviewItems(fb,{sourceId:fb.id,pagesChecked:1,discovered:[item],ignored:0,failed:0,locationRejected:0,warnings:[]});
  expect(await ingest()).toMatchObject({created:1,published:1});
  const [original]=await listLiveCatalogue(true);
  await manageCatalogue("PATCH",form(original,{title:"Cátedra — título administrativo",evidenceExcerpt:item.evidenceJson.opportunity_status.excerpt}));
  expect((await listLiveCatalogue())[0]).toMatchObject({countryCode:"US",geographicScopeKind:"country"});
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(html),contentType:"text/html",hash:"same",cached:false});
  expect(await recheckKnownOpportunities(fb,1,async()=>"")).toMatchObject({pagesChecked:1,failed:0});
  expect((await listLiveCatalogue())[0]).toMatchObject({id:original.id,title:"Cátedra — título administrativo",categories:["bolsas","intercambios","pesquisa"],countryCode:"US",geographicScopeKind:"country"});
  expect((await listLiveCatalogue(true)).map(o=>o.id)).toEqual((await listLiveCatalogue()).map(o=>o.id));
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from("<body>Manutenção</body>"),contentType:"text/html",hash:"unavailable",cached:false});
  expect(await recheckKnownOpportunities(fb,1,async()=>"")).toMatchObject({failed:1});
  expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(html.replace("Inscreva-se","Inscrições indisponíveis")),contentType:"text/html",hash:"no-cta",cached:false});
  expect(await recheckKnownOpportunities(fb,1,async()=>"")).toMatchObject({pagesChecked:1,failed:0});
  expect(await listLiveCatalogue()).toHaveLength(0);
  expect(await ingest()).toMatchObject({created:0,published:1});
  await state.db!.query("update opportunities set deleted_at=now() where id=$1",[original.id]);
  expect(await ingest()).toMatchObject({created:0,published:0});
  expect(await listLiveCatalogue()).toHaveLength(0);
 } finally {vi.useRealTimers();}
});

it("rechecks both PDAI pages through RLS and withdraws a valid empty/conflicting selection", async () => {
 const {normalizeCapesPdai}=await import("@/lib/ingestion/normalize-capes-pdai");
 const {pdaiSource:pdai,pdaiProgramme:programme,pdaiNews:news}=await import("./fixtures/capes-pdai");
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-14T23:55:00Z"));
 try {
  await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status) values ($1,'PDAI','CAPES','CAPES','government_foundation',$2,$3,$4,$5,'html',true,'verified')`,[pdai.id,pdai.baseUrl,pdai.allowedDomains,pdai.allowedPathPrefixes,pdai.listingUrls]);
  const item=normalizeCapesPdai(programme,news,pdai)[0];
  const ingest=()=>saveReviewItems(pdai,{sourceId:pdai.id,pagesChecked:2,discovered:[item],ignored:0,failed:0,locationRejected:0,warnings:[]});
  expect(await ingest()).toMatchObject({created:1,published:1});expect(await ingest()).toMatchObject({created:0});
  const [original]=await listLiveCatalogue();expect(original.deadlinePrecision).toBe("exact_datetime");
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdai.baseUrl?programme:news),contentType:"text/html",hash:"ok",cached:false}));
  expect(await recheckKnownOpportunities(pdai,1,async()=>"")).toMatchObject({pagesChecked:2,failed:0});
  expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockRejectedValue(new Error("official page unavailable"));
  expect(await recheckKnownOpportunities(pdai,1,async()=>"")).toMatchObject({failed:1});
  expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdai.baseUrl?programme:'<div id="page-document"><h1>Prazo de inscrição no PDAI é prorrogado até 26 de outubro</h1></div>'),contentType:"text/html",hash:"partial",cached:false}));
  expect(await recheckKnownOpportunities(pdai,1,async()=>"")).toMatchObject({failed:1});
  expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdai.baseUrl?programme.replace("26 de outubro","25 de outubro"):news),contentType:"text/html",hash:"conflict",cached:false}));
  expect(await recheckKnownOpportunities(pdai,1,async()=>"")).toMatchObject({pagesChecked:2,failed:0});
  expect(await listLiveCatalogue()).toHaveLength(0);
  expect(await ingest()).toMatchObject({created:0,published:1});
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdai.baseUrl?programme:news.replace("</div>","<p>Inscrições suspensas.</p></div>")),contentType:"text/html",hash:"suspended",cached:false}));
  expect(await recheckKnownOpportunities(pdai,1,async()=>"")).toMatchObject({pagesChecked:2,failed:0});
  expect(await listLiveCatalogue()).toHaveLength(0);
  const terminal=(await state.db!.query<{opportunity_status:string;evidence_json:OpportunityCandidate["evidenceJson"]}>("select opportunity_status,evidence_json from opportunities where id=$1",[original.id])).rows[0];
  expect(terminal.opportunity_status).toBe("suspended");
  expect(terminal.evidence_json.opportunity_status).toMatchObject({source_url:pdai.allowedPathPrefixes[1] ? "https://www.gov.br"+pdai.allowedPathPrefixes[1] : "",excerpt:expect.stringContaining("Inscrições suspensas")});
  await state.db!.query("update opportunities set deleted_at=now() where id=$1",[original.id]);
  expect(await ingest()).toMatchObject({created:0,published:0});
 }finally{vi.useRealTimers();}
});

it("preserves PDSE identity and admin edits across upcoming/open stages and terminal withdrawal", async () => {
 const {normalizeCapesPdse}=await import("@/lib/ingestion/normalize-capes-pdse");
 const {pdseSource:pdse,pdseProgramme:programme,pdseNews:news}=await import("./fixtures/capes-pdse");
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-15T00:40:00Z"));
 try {
  await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status) values ($1,'PDSE','CAPES','CAPES','government_foundation',$2,$3,$4,$5,'html',true,'verified')`,[pdse.id,pdse.baseUrl,pdse.allowedDomains,pdse.allowedPathPrefixes,pdse.listingUrls]);
  const item=normalizeCapesPdse(programme,news,pdse)[0];
  const ingest=()=>saveReviewItems(pdse,{sourceId:pdse.id,pagesChecked:2,discovered:[item],ignored:0,failed:0,locationRejected:0,warnings:[]});
  expect(await ingest()).toMatchObject({created:1,published:1});expect(await ingest()).toMatchObject({created:0});
  const [original]=await listLiveCatalogue(true);expect(original.opportunityStatus).toBe("upcoming");
  await manageCatalogue("PATCH",form(original,{title:"PDSE — título administrativo",deadlineAt:item.deadlineAt,evidenceExcerpt:item.evidenceJson.deadline_at.excerpt}));
  vi.setSystemTime(new Date("2026-10-20T15:00:00Z"));
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdse.baseUrl?programme:news),contentType:"text/html",hash:"open",cached:false}));
  expect(await recheckKnownOpportunities(pdse,1,async()=>"")).toMatchObject({pagesChecked:2,failed:0});
  expect((await listLiveCatalogue())[0]).toMatchObject({id:original.id,title:"PDSE — título administrativo",opportunityStatus:"open"});
  expect((await listLiveCatalogue(true)).map(o=>o.id)).toEqual((await listLiveCatalogue()).map(o=>o.id));
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from('<div id="page-document"><h1>Programa de Doutorado-sanduíche no Exterior (PDSE)</h1></div>'),contentType:"text/html",hash:"partial",cached:false});
  expect(await recheckKnownOpportunities(pdse,1,async()=>"")).toMatchObject({failed:1});expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);
  vi.mocked(fetchOfficialResource).mockImplementation(async url=>({body:Buffer.from(url===pdse.baseUrl?programme:news.replace("</div>","<p>Chamada cancelada.</p></div>")),contentType:"text/html",hash:"cancelled",cached:false}));
  expect(await recheckKnownOpportunities(pdse,1,async()=>"")).toMatchObject({pagesChecked:2,failed:0});expect(await listLiveCatalogue()).toHaveLength(0);
  const terminal=(await state.db!.query<{opportunity_status:string;evidence_json:OpportunityCandidate["evidenceJson"]}>("select opportunity_status,evidence_json from opportunities where id=$1",[original.id])).rows[0];
  expect(terminal.opportunity_status).toBe("cancelled");expect(terminal.evidence_json.opportunity_status.excerpt).toContain("Chamada cancelada");
  await state.db!.query("update opportunities set deleted_at=now() where id=$1",[original.id]);expect(await ingest()).toMatchObject({created:0,published:0});
 }finally{vi.useRealTimers();}
});

it("exports the same admission group for public/admin and retains original edit/delete identities", async () => {
 await save();
 await state.db!.exec(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
 values ('ifsc-technical-courses-2027','IFSC','IFSC','IFSC','federal_institute','https://www.ifsc.edu.br/tecnicos',array['www.ifsc.edu.br'],array['/tecnicos'],array['https://www.ifsc.edu.br/tecnicos'],'html',true,'verified');
 update opportunities set official_source_id='ifsc-technical-courses-2027',requirements_text='Curso no Câmpus X; seleção por prova. Oferta: 40 vagas.';
 update opportunity_sources set source_page_url='https://www.ifsc.edu.br/tecnicos';`);
 const [before] = await listLiveCatalogue();
 expect(before.admissionProcess).toMatchObject({ id: 'ifsc-technical-exam-2027-1' });
 expect(before).not.toHaveProperty('_sourceId');
 const [managed] = await listLiveCatalogue(true); expect(managed).toMatchObject(before);
 await manageCatalogue('PATCH', form(managed, { title: 'Título editado pelo administrador' }));
 const [edited] = await listLiveCatalogue(); expect(edited.id).toBe(before.id); expect(edited.admissionProcess).toEqual(before.admissionProcess);
 await state.db!.query('update opportunities set deleted_at=now() where id=$1',[edited.id]);
 expect(await listLiveCatalogue()).toEqual([]); expect(await listLiveCatalogue(true)).toEqual([]);
});

it("preserves an ACIM edition through RLS, edits, retry, sold-out withdrawal and tombstone", async () => {
 const {normalizeAcimStartupWeekend}=await import("@/lib/ingestion/normalize-acim-startup-weekend");
 const {acimSource:acim,acimHtml:html}=await import("./fixtures/acim-startup-weekend");
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-15T01:20:00Z"));
 try {
  await state.db!.query(`insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status) values ($1,'ACIM','ACIM','ACIM','corporate_organizer',$2,$3,$4,$5,'html',true,'verified')`,[acim.id,acim.baseUrl,acim.allowedDomains,acim.allowedPathPrefixes,acim.listingUrls]);
  const item=normalizeAcimStartupWeekend(html,acim)[0];const ingest=()=>saveReviewItems(acim,{sourceId:acim.id,pagesChecked:1,discovered:[item],ignored:0,failed:0,locationRejected:0,warnings:[]});
  expect(await ingest()).toMatchObject({created:1,published:1});expect(await ingest()).toMatchObject({created:0});
  const [original]=await listLiveCatalogue(true);expect(original).toMatchObject((await listLiveCatalogue())[0]);
  await manageCatalogue("PATCH",form(original,{title:"Startup Weekend — edição administrativa",deadlineAt:"",eventStartsAt:item.eventStartsAt,evidenceExcerpt:item.evidenceJson.event_start.excerpt}));
  const recheck=async(body:string)=>{await state.db!.query("update opportunities set next_source_check_at=null where id=$1",[original.id]);vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(body),contentType:"text/html",hash:"check",cached:false});return recheckKnownOpportunities(acim,1,async()=>"");};
  expect(await recheck(html)).toMatchObject({pagesChecked:1,failed:0});expect((await listLiveCatalogue())[0]).toMatchObject({id:original.id,title:"Startup Weekend — edição administrativa",deadlinePrecision:"not_informed"});
  expect(await recheck('<h1 data-hook="event-title">Startup Weekend Imbituba</h1>')).toMatchObject({failed:1});expect(await listLiveCatalogue()).toHaveLength(1);
  expect(await recheck(html.replaceAll('https://schema.org/InStock','https://schema.org/SoldOut'))).toMatchObject({pagesChecked:1,failed:0});expect(await listLiveCatalogue()).toHaveLength(0);
  const row=(await state.db!.query<{opportunity_status:string;evidence_json:OpportunityCandidate["evidenceJson"]}>("select opportunity_status,evidence_json from opportunities where id=$1",[original.id])).rows[0];expect(row.opportunity_status).toBe("closed");expect(row.evidence_json.opportunity_status.excerpt).toContain("SoldOut");
  await state.db!.query("update opportunities set deleted_at=now() where id=$1",[original.id]);expect(await ingest()).toMatchObject({created:0,published:0});
 }finally{vi.useRealTimers();}
});

it("migrates only the audited CPS canonical path and keeps unrelated paths outside the allowlist", async () => {
 expect(cpsRedirectPaths).toEqual([
  "/editais-abertos/",
  "/intercambio-cultural-do-centro-paula-souza-abre-inscricoes-para-mais-de-500-bolsas-internacionais-em-2027/",
  "/intercambio-cultural-cps-2026/",
 ]);
});

it("keeps CPS cultural and virtual selections distinct on the same official index and preserves tombstones", async () => {
 const url="https://arinter.cps.sp.gov.br/editais-abertos/";
 const definitions=[['cps-cultural-15-2026','Intercâmbio Cultural CPS'],['cps-virtual-mobility-031-2026','Mobilidade virtual CPS ARI031/2026']];
 const sources:OfficialSource[]=definitions.map(([id,name])=>({...source,id,name,baseUrl:url,allowedDomains:['arinter.cps.sp.gov.br'],allowedPathPrefixes:['/editais-abertos/'],listingUrls:[url]}));
 for(const s of sources) await state.db!.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
 values($1,$2,'Centro Paula Souza','CPS','official_reference',$3,$4,$5,$6,'html',true,'verified')`,[s.id,s.name,url,s.allowedDomains,s.allowedPathPrefixes,s.listingUrls]);
 const make=(s:OfficialSource)=>candidate({officialSourceId:s.id,title:s.name,sourcePageUrl:url,categories:['intercambios'],evidenceJson:{deadline_at:{source_url:url,excerpt:'Inscrições até 20/10/2099'},opportunity_status:{source_url:url,excerpt:'Inscrições abertas'}}});
 const ingest=(s:OfficialSource)=>saveReviewItems(s,{sourceId:s.id,pagesChecked:1,discovered:[make(s)],ignored:0,failed:0,locationRejected:0,warnings:[]});
 for(const s of sources) expect(await ingest(s)).toMatchObject({created:1,published:1});
 const original=await listLiveCatalogue(true);expect(original).toHaveLength(2);expect(new Set(original.map(x=>x.id)).size).toBe(2);
 const virtual=original.find(x=>x.officialSourceId==='cps-virtual-mobility-031-2026')!;
 await state.db!.query('update opportunities set deleted_at=now() where id=$1',[virtual.id]);
 expect(await ingest(sources[1])).toMatchObject({created:0,published:0});
 expect((await listLiveCatalogue()).map(x=>x.title)).toEqual(['Intercâmbio Cultural CPS']);
});

it("keeps audited stages after registration closes, preserves them across crawls and hides removed/conflicting records", async () => {
 const discovery = { primaryType:"competicoes", subtype:"olimpiada", areas:["matematica"], editions:[{id:"2099",name:"2099",stages:[{id:"exam",name:"Prova",kind:"exam" as const,start:"2099-11-01",sourceUrl:evidence.source_url,checkedAt:"2026-10-28T12:00:00Z"}]}] };
 await save(candidate({discovery}));
 const first=(await listLiveCatalogue(true))[0];
 await save(candidate({deadlineAt:"2000-01-01",opportunityStatus:"closed",contentHash:"closed"}));
 expect(await listLiveCatalogue()).toHaveLength(0);
 expect(await listCalendarCatalogue()).toHaveLength(1);
 const current=(await listLiveCatalogue(true))[0];
 expect(current.discovery).toEqual(discovery);
 await expect(manageCatalogue("PATCH",form(current,{discovery:{...discovery,areas:["invented"]}}))).rejects.toThrow();
 await state.db!.query("update opportunities set source_conflict=true where id=$1",[first.id]);
 expect(await listCalendarCatalogue()).toHaveLength(0);
 await state.db!.query("update opportunities set source_conflict=false,deleted_at=now() where id=$1",[first.id]);
 expect(await listCalendarCatalogue()).toHaveLength(0);
});
it("rejects unaudited or impossible calendar dates before persistence", async () => {
 for(const patch of [{start:"2099-02-30"},{sourceUrl:"https://untrusted.test"},{checkedAt:"2099-01-01T00:00:00Z"},{start:"2099-01-01T12:00:00"}]) {
  await expect(save(candidate({ discovery:{areas:[],editions:[{id:"x",name:"x",stages:[{id:"s",name:"Etapa",kind:"exam",start:"2099-11-01",sourceUrl:evidence.source_url,checkedAt:"2026-10-28T12:00:00Z",...patch}]}]} }))).rejects.toThrow();
 }
 expect(await listLiveCatalogue()).toHaveLength(0);
});

it("persists editorial classification and all calendar stages, preserves curation and removes inactive sources", async () => {
 await save(candidate());
 const original=(await listLiveCatalogue(true))[0];
 const discovery={primaryType:"competicoes",subtype:"olimpiada",areas:["matematica","fisica"],editions:[{id:"2099",name:"Edição 2099",stages:[
  {id:"exam",name:"Prova",kind:"exam",start:"2099-11-01T13:00:00-03:00",end:"2099-11-01T18:00:00-03:00",sourceUrl:evidence.source_url,checkedAt:"2026-10-28T12:00:00Z"},
  {id:"result",name:"Resultado",kind:"result",start:"2099-12-01",sourceUrl:evidence.source_url,checkedAt:"2026-10-28T12:00:00Z"},
 ]}]};
 await manageCatalogue("PATCH",form(original,{discovery,opportunityStatus:"closed",deadlinePrecision:"not_informed",deadlineAt:""}));
 expect(await listLiveCatalogue()).toHaveLength(0);
 expect((await listCalendarCatalogue())[0]).toMatchObject({discovery});
 await save(candidate({contentHash:"subsequent-crawl",discovery:{primaryType:"formacao",areas:[],editions:[]}}));
 expect((await listCalendarCatalogue())[0]).toMatchObject({discovery});
 await state.db!.query("update opportunities set opportunity_status='result_published',deadline_at='2000-01-01' where id=$1",[original.id]);
 expect(await listLiveCatalogue()).toHaveLength(0);
 expect(await listCalendarCatalogue()).toHaveLength(1);
 await state.db!.query("update official_sources set active=false where id=$1",[source.id]);
 expect(await listCalendarCatalogue()).toHaveLength(0);
});


it("ingests and rechecks a Luma edition without duplicates, queues one date update and preserves curation/failures/tombstones", async () => {
 vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-30T18:00:00Z"));
 try {
  const s={...expansionSources().find(s=>s.id==='exp-luma-womakers-2026')!,active:true};
  await state.db!.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
    values($1,$2,$3,'','official_reference',$4,$5,$6,$7,'html',true,'verified')`,[s.id,s.name,s.institutionName,s.baseUrl,s.allowedDomains,s.allowedPathPrefixes,s.listingUrls]);
  const html=await readFile(new URL('./fixtures/expansion/'+s.id+'.html',import.meta.url),'utf8');
  const respond=(body:string)=>vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(body),contentType:'text/html',hash:'fixture',cached:false});
  respond(html);
  expect(await runOfficialSourceIngestion({sourceId:s.id,maxPages:3})).toMatchObject({discovered:1,published:1});
  await runOfficialSourceIngestion({sourceId:s.id,maxPages:3});
  const rows=()=>state.db!.query<{id:string;event_starts_at:string;requirements_text:string;deleted_at:string|null}>("select id,event_starts_at,requirements_text,deleted_at from opportunities where official_source_id=$1",[s.id]);
  expect((await rows()).rows).toHaveLength(1); const id=(await rows()).rows[0].id;
  await state.db!.query("update opportunities set requirements_text='Curadoria preservada',management_overrides=$2,next_source_check_at=null where id=$1",[id,{requirementsText:'Curadoria preservada'}]);
  await subscribeToOpportunity({opportunityId:id,email:'isolated-student@example.test',consent:true});
  const payload=(await state.db!.query<{payload:{text:string}}>("select payload from opportunity_alert_outbox where kind='confirmation' order by created_at desc limit 1")).rows[0].payload;
  await updateAlertSubscription('confirm',/acao=confirmar&token=([a-f0-9]{64})/.exec(payload.text)![1]);
  respond(html.replaceAll('2026-12-03','2026-12-04'));
  expect(await recheckKnownOpportunities(s,2,async()=>'' )).toMatchObject({failed:0,pagesChecked:1});
  expect((await rows()).rows[0]).toMatchObject({id,requirements_text:'Curadoria preservada'});
  expect(String((await rows()).rows[0].event_starts_at)).toContain('2026-12-04');
  expect(await queueOpportunityChanges()).toBe(1); expect(await queueOpportunityChanges()).toBe(0);
  await state.db!.query('update opportunities set next_source_check_at=null where id=$1',[id]);
  respond('<main>Access denied</main>');
  expect(await recheckKnownOpportunities(s,2,async()=>'' )).toMatchObject({failed:1});
  expect(String((await rows()).rows[0].event_starts_at)).toContain('2026-12-04');
  expect(await queueOpportunityChanges()).toBe(0);
  await state.db!.query('update opportunities set deleted_at=now() where id=$1',[id]);
  respond(html); await runOfficialSourceIngestion({sourceId:s.id,maxPages:3});
  expect((await rows()).rows).toHaveLength(1); expect((await rows()).rows[0].deleted_at).not.toBeNull();
  expect(sendAlertMail).not.toHaveBeenCalled();
 } finally {vi.useRealTimers();}
});
it("persists two ocean modalities on one URL and closes only the named modality",async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date('2026-10-30T18:00:00Z'));
 try {
  const s={...expansionSources().find(s=>s.id==='exp-oceano-2026')!,active:true};
  await state.db!.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
    values($1,$2,$3,'','official_reference',$4,$5,$6,$7,'html',true,'verified')`,[s.id,s.name,s.institutionName,s.baseUrl,s.allowedDomains,s.allowedPathPrefixes,s.listingUrls]);
  const html=await readFile(new URL('./fixtures/expansion/'+s.id+'.html',import.meta.url),'utf8');
  const respond=(body:string)=>vi.mocked(fetchOfficialResource).mockResolvedValue({body:Buffer.from(body),contentType:'text/html',hash:'fixture',cached:false});
  respond(html);
  expect(await runOfficialSourceIngestion({sourceId:s.id,maxPages:3})).toMatchObject({discovered:2,published:2});
  await runOfficialSourceIngestion({sourceId:s.id,maxPages:3});
  expect((await state.db!.query("select id from opportunities where official_source_id=$1",[s.id])).rows).toHaveLength(2);
  await state.db!.query('update opportunities set next_source_check_at=null where official_source_id=$1',[s.id]);
  respond(html.replace('</article>','<p>Educadores que Inspiram: inscrições encerradas.</p></article>'));
  expect(await recheckKnownOpportunities(s,3,async()=>'' )).toMatchObject({failed:0,pagesChecked:1});
  const live=await listLiveCatalogue(); expect(live).toHaveLength(1); expect(live[0].title).toContain('Desafio WOA');
 } finally {vi.useRealTimers();}
});
