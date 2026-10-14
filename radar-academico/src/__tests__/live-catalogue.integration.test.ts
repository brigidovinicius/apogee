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
 const row = (await state.db!.query("select human_verified_at,verification_method from opportunities")).rows[0];
 expect(row).toEqual({ human_verified_at: null, verification_method: "automatic" });
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

it("migration retains verified publications and does not promote legacy pending records", () => {
 expect(migrationSnapshot).toEqual([
  { review_status: "approved", verification_method: "admin", verified: true, published: true },
  { review_status: "pending_review", verification_method: null, verified: false, published: false },
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
