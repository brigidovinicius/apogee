import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/db/client", () => ({
  withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) => state.db!.transaction(async (tx) => {
    await tx.exec("set local role radar_test; select set_config('app.is_admin','true',true)");
    return work(tx as unknown as PoolClient);
  }),
  queryPublic: (sql: string, values: unknown[] = []) => state.db!.transaction(async (tx) => {
    await tx.exec("set local role radar_test; select set_config('app.is_admin','false',true)");
    return tx.query(sql, values);
  }),
}));
vi.mock("@/lib/ingestion/fetch-source", () => ({ fetchOfficialResource: vi.fn() }));
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { recheckKnownOpportunities } from "@/lib/ingestion/recheck";
import { saveReviewItems } from "@/lib/ingestion/save-review-item";
import { listLiveCatalogue } from "@/lib/db/live-catalogue";
import { manageCatalogue } from "@/lib/official-sources/catalogue-management";
import { claimDueOfficialSources, completeScheduledSource } from "@/lib/ingestion/official-source-registry";
import { claimDueDiscoveryTargets, completeDiscoveryTarget } from "@/lib/discovery/watchlist";
import { withAdminTransaction } from "@/lib/db/client";

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
 migrationSnapshot = (await state.db.query("select review_status,verification_method,verified_at is not null as verified,published_at is not null as published from opportunities order by title")).rows;
 pilotSourcesSnapshot = (await state.db.query("select id,verification_status,verification_method,verification_evidence_url,audited_by from official_sources where id in ('cnpq-chamadas-abertas-2026','nasa-space-apps-2026') order by id")).rows;
 await state.db.exec("create role radar_test; grant usage on schema public to radar_test; grant select,insert,update,delete on all tables in schema public to radar_test");
 vi.stubEnv("DATABASE_URL", "isolated-test-only");
}, 30_000);
afterAll(async () => { await state.db?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
 vi.clearAllMocks();
 await state.db!.exec("truncate official_sources,opportunities,opportunity_sources,opportunity_revisions,ingestion_runs,opportunity_management_events cascade");
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
