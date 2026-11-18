import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import type { PoolClient } from "pg";
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/db/client", () => ({
  withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) => state.db!.transaction(async tx => {
    await tx.exec("set local role radar_editor; select set_config('app.is_admin','true',true)"); return work(tx as unknown as PoolClient);
  }),
  queryPublic: (sql: string, values: unknown[] = []) => state.db!.transaction(async tx => {
    await tx.exec("set local role radar_reader; select set_config('app.is_admin','false',true)"); return tx.query(sql, values);
  }),
}));
vi.mock("@/lib/ingestion/job-api", () => ({ fetchPublicJobApi: vi.fn() }));
vi.mock("@/lib/ingestion/fetch-source", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/ingestion/fetch-source")>(), fetchOfficialResource: vi.fn(),
}));
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { fetchPublicJobApi } from "@/lib/ingestion/job-api";
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { listLiveCatalogue } from "@/lib/db/live-catalogue";
import { manageCatalogue } from "@/lib/official-sources/catalogue-management";
import { claimDueOfficialSources, completeScheduledSource } from "@/lib/ingestion/official-source-registry";
import { verifyEditorialSource, setEditorialSourceActive } from "@/lib/official-sources/editorial";
const fixture = { id: "8013f907-e90f-4e3d-92c2-d14808891efb", title: "Forward Deployed Engineer (Brazil)",
  jobUrl: "https://jobs.ashbyhq.com/whippy/8013f907-e90f-4e3d-92c2-d14808891efb", isListed: true,
  applyUrl: "https://jobs.ashbyhq.com/whippy/8013f907-e90f-4e3d-92c2-d14808891efb/application",
  workplaceType: "Remote", location: "Remote Brazil", employmentType: "FullTime",
  descriptionPlain: "Remote, based in Brazil. 2+ years of experience. Build production integrations with customers." };
const respond = (jobs: unknown[]) => vi.mocked(fetchPublicJobApi).mockResolvedValue({ body: Buffer.from(JSON.stringify({ apiVersion: "1", jobs })), contentType: "application/json", hash: "fixture", cached: false });
beforeAll(async () => {
  const admin = process.env.RADAR_JOBS_TEST_ADMIN_URL;
  if (admin) {
    const url = new URL(admin);
    if (url.hostname !== "127.0.0.1" || url.username !== "postgres" || url.pathname !== "/radar_jobs_test") throw Error("Disposable loopback database required");
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: admin, max: 1 });
    if ((await pool.query("select to_regclass('public.opportunities') as name")).rows[0].name) throw Error("Empty disposable database required");
    state.db = { query: (sql: string, args?: unknown[]) => pool.query(sql, args), exec: (sql: string) => pool.query(sql),
      close: () => pool.end(), transaction: async (work: (tx: unknown) => Promise<unknown>) => {
        const client = await pool.connect();
        try { await client.query("begin"); const result = await work({ query: (sql: string, args?: unknown[]) => client.query(sql, args), exec: (sql: string) => client.query(sql) }); await client.query("commit"); return result; }
        catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
      } } as unknown as PGlite;
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
    state.db = new PGlite({ extensions: { pgcrypto } });
  }
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const file of (await readdir(dir)).filter(f => f.endsWith(".sql")).sort()) await state.db.exec(await readFile(new URL(file, dir), "utf8"));
  vi.stubEnv("DATABASE_EDITOR_URL", "isolated-test"); vi.stubEnv("DATABASE_READER_URL", "isolated-test");
}, 60_000);
beforeEach(async () => {
  await state.db!.exec("truncate opportunities cascade; update official_sources set active=true,verification_status='verified' where id='jobs-whippy'");
  respond([fixture]);
});
afterAll(async () => { await state.db?.close(); vi.unstubAllEnvs(); });

it("prioritizes due audited job feeds over older overdue HTML sources without changing their cadence", async () => {
  const snapshot = await state.db!.query<{ id: string; next_crawl_at: Date | null }>("select id,next_crawl_at from official_sources");
  try {
    await state.db!.exec("update official_sources set next_crawl_at=now()+interval '1 day'");
    await state.db!.exec("update official_sources set next_crawl_at=now()-interval '1 minute' where id='jobs-whippy'");
    await state.db!.exec(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
      allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,priority,active,verification_status,next_crawl_at)
      select 'test-overdue-html',name,institution_name,institution_acronym,source_type,'https://example.edu.br/',
        array['example.edu.br'],array['/'],array['https://example.edu.br/'],'html',100,true,'verified',now()-interval '2 days'
      from official_sources where id='jobs-whippy'`);
    expect((await claimDueOfficialSources(1)).map(s => s.id)).toEqual(["jobs-whippy"]);
    expect((await claimDueOfficialSources(1)).map(s => s.id)).toEqual(["test-overdue-html"]);
    await completeScheduledSource("jobs-whippy", false);
    expect((await state.db!.query<{ paced: boolean }>("select next_crawl_at>now()+interval '5 hours 59 minutes' paced from official_sources where id='jobs-whippy'")).rows[0].paced).toBe(true);
  } finally {
    await state.db!.exec("delete from official_sources where id='test-overdue-html'");
    for (const row of snapshot.rows) await state.db!.query("update official_sources set next_crawl_at=$2 where id=$1", [row.id, row.next_crawl_at]);
  }
});

it("captures and publishes FAPESP automatically across its host migration, preserving identity, aliases and deletion", async () => {
  const sourceId = "fapesp-open-fellowships", oldRoot = "https://fapesp.br/oportunidades/", currentRoot = "https://oportunidades.fapesp.br/";
  const legacy = oldRoot + "projeto-de-logica/9715/", current = currentRoot + "projeto-de-logica/9715/";
  const snapshot = (await state.db!.query<{ data: Record<string, unknown> }>("select to_jsonb(s) data from official_sources s where id=$1", [sourceId])).rows[0].data;
  const body = `<main><h1>FAPESP | Fundo de Amparo à Pesquisa do Estado de São Paulo</h1>
    <p>Bolsa de PD em Lógica. Título do projeto: Projeto de teste Project title: Test project</p>
    <p>Unidade/Instituição: Instituto de Pesquisa Unit/Instituition: Research Institute</p>
    <p>Data limite para inscrições: 15/10/2099 Deadline for submissions: 2099-10-15</p>
    <p>E-mail para inscrições: bolsas@example.edu.br E-mail for proposal submission: bolsas@example.edu.br</p></main>`;
  const respondFapesp = (posting: string) => vi.mocked(fetchOfficialResource).mockImplementation(async url => ({
    body: Buffer.from(url === oldRoot || url === currentRoot
      ? `<h1>Oportunidades de Bolsas</h1><a href="${posting}">Bolsa de PD em Lógica</a>` : body),
    contentType: "text/html", hash: "test-public-snapshot", cached: false,
  }));
  try {
    await state.db!.query(`update official_sources set active=true,verification_status='verified',base_url=$2,listing_urls=array[$2],
      allowed_domains=array['fapesp.br','www.fapesp.br'],allowed_path_prefixes=array['/oportunidades/'],crawl_listing_index=0,crawl_link_offset=0 where id=$1`, [sourceId, oldRoot]);
    respondFapesp(legacy);
    expect(await runOfficialSourceIngestion({ sourceId, maxPages: 2 })).toMatchObject({ published: 1, discovered: 1 });
    const [first] = await listLiveCatalogue(); expect(first.officialUrl).toBe(legacy);
    const budget = (await state.db!.query<{ data: unknown }>("select radar_ai.status() data")).rows[0].data;
    await state.db!.exec(await readFile(new URL("../../db/migrations/0062_source_canonical_paths.sql", import.meta.url), "utf8"));
    expect((await state.db!.query<{ data: unknown }>("select radar_ai.status() data")).rows[0].data).toEqual(budget);
    const migrated = (await state.db!.query("select base_url,active,verification_status from official_sources where id=$1", [sourceId])).rows[0];
    expect(migrated).toEqual({ base_url: currentRoot, active: true, verification_status: "verified" });
    respondFapesp(current);
    await runOfficialSourceIngestion({ sourceId, maxPages: 2 });
    const catalogue = await listLiveCatalogue(); expect(catalogue).toHaveLength(1);
    expect(catalogue[0]).toMatchObject({ id: first.id, officialUrl: current });
    const aliases = (await state.db!.query<{ source_page_url: string; active: boolean; is_primary: boolean }>(
      "select source_page_url,active,is_primary from opportunity_sources where opportunity_id=$1 order by created_at", [first.id])).rows;
    expect(aliases).toContainEqual({ source_page_url: legacy, active: false, is_primary: false });
    expect(aliases).toContainEqual({ source_page_url: current, active: true, is_primary: true });
    await state.db!.exec("update opportunities set next_source_check_at=now()-interval '1 minute'");
    vi.mocked(fetchOfficialResource).mockRejectedValue(Error("Fonte oficial indisponível (HTTP 502)"));
    await runOfficialSourceIngestion({ sourceId, maxPages: 5 });
    expect((await listLiveCatalogue()).map(c => c.id)).toEqual([first.id]);
    respondFapesp(current);
    await state.db!.exec("update opportunities set deleted_at=now()");
    await runOfficialSourceIngestion({ sourceId, maxPages: 2 });
    expect(await listLiveCatalogue()).toEqual([]);
    expect((await state.db!.query<{ n: number }>("select count(*)::int n from opportunities where official_source_id=$1", [sourceId])).rows[0].n).toBe(1);
  } finally {
    await state.db!.query(`update official_sources s set
      (base_url,listing_urls,allowed_domains,allowed_path_prefixes,active,verification_status,crawl_listing_index,crawl_link_offset,next_crawl_at)=
      (select r.base_url,r.listing_urls,r.allowed_domains,r.allowed_path_prefixes,r.active,r.verification_status,r.crawl_listing_index,r.crawl_link_offset,r.next_crawl_at
       from jsonb_populate_record(null::official_sources,$2::jsonb) r) where s.id=$1`, [sourceId, JSON.stringify(snapshot)]);
    vi.mocked(fetchOfficialResource).mockReset();
  }
});

it("seeds expansion sources inactive and keeps Brazil remote publication behind audit", async () => {
  const ids=["jobs-latamcent","jobs-truelogic","jobs-oscilar","jobs-elevenlabs","jobs-telnyx"];
  const seeded=await state.db!.query<{id:string;active:boolean;verification_status:string}>(
    "select id,active,verification_status from official_sources where id=any($1::text[])",[ids]);
  expect(seeded.rows).toHaveLength(5);
  expect(seeded.rows.every(s=>!s.active&&s.verification_status==="pending")).toBe(true);
  await expect(setEditorialSourceActive({sourceId:"jobs-truelogic",active:true})).rejects.toThrow();
  await verifyEditorialSource({sourceId:"jobs-truelogic",officialSource:true,locationConfirmed:true,collectionAllowed:true});
  await setEditorialSourceActive({sourceId:"jobs-truelogic",active:true});
  const page=fixture.jobUrl.replace("/whippy/","/truelogic/");
  respond([{...fixture,jobUrl:page,applyUrl:page+"/application"}]);
  await expect(runOfficialSourceIngestion({sourceId:"jobs-truelogic"})).resolves.toMatchObject({published:1});
  expect((await listLiveCatalogue())[0].institution).toBe("Truelogic");
  await state.db!.exec("update official_sources set active=false,verification_status='pending' where id='jobs-truelogic'");
});
it("leases newly audited boards for automatic collection, excluding unregistered API sources", async () => {
  const ids=["jobs-latamcent","jobs-truelogic","jobs-oscilar","jobs-elevenlabs","jobs-telnyx"];
  const snapshot=await state.db!.query<{id:string;active:boolean;verification_status:string;next_crawl_at:Date|null;last_crawled_at:Date|null}>(
    "select id,active,verification_status,next_crawl_at,last_crawled_at from official_sources");
  try {
    await state.db!.exec("update official_sources set next_crawl_at=now()+interval '1 day'");
    await state.db!.query("update official_sources set active=true,verification_status='verified',next_crawl_at=null where id=any($1::text[])",[ids]);
    await state.db!.exec(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
      allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,priority,active,verification_status)
      select 'test-unregistered-job-api',name,institution_name,institution_acronym,source_type,base_url,
        allowed_domains,allowed_path_prefixes,listing_urls,'api',100,true,'verified'
      from official_sources where id='jobs-truelogic'`);
    expect((await claimDueOfficialSources(10)).map(s=>s.id).sort()).toEqual([...ids].sort());
    expect(await claimDueOfficialSources(10)).toEqual([]);
    for(const id of ids) await completeScheduledSource(id,false);
    const cadence=await state.db!.query<{ready:boolean}>(`select bool_and(last_crawled_at is not null and
      next_crawl_at>now()+interval '5 hours 59 minutes' and next_crawl_at<=now()+interval '6 hours 1 minute') ready
      from official_sources where id=any($1::text[])`,[ids]);
    expect(cadence.rows[0].ready).toBe(true);
  } finally {
    await state.db!.exec("delete from official_sources where id='test-unregistered-job-api'");
    for(const row of snapshot.rows) await state.db!.query(
      "update official_sources set active=$2,verification_status=$3,next_crawl_at=$4,last_crawled_at=$5 where id=$1",
      [row.id,row.active,row.verification_status,row.next_crawl_at,row.last_crawled_at]);
  }
});
it("persists through real ingestion, exposes through reader RLS and preserves identity on a title change", async () => {
  expect(await runOfficialSourceIngestion({ sourceId: "jobs-whippy", maxPages: 1 })).toMatchObject({ discovered: 1, published: 1 });
  const [first] = await listLiveCatalogue(); expect(first.employment).toMatchObject({ brazilEligibility: "confirmed" });
  respond([{ ...fixture, title: "Senior Forward Deployed Engineer (Brazil)" }]);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy", maxPages: 1 });
  const current = await listLiveCatalogue(); expect(current).toHaveLength(1); expect(current[0].id).toBe(first.id);
});
it("keeps administrative overrides and tombstones during collection", async () => {
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  await state.db!.exec(`select set_config('app.is_admin','true',false);
    update opportunities set management_overrides='{"requirementsText":"Requisito editorial preservado"}'`);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  expect((await listLiveCatalogue())[0].requirementsText).toBe("Requisito editorial preservado");
  await state.db!.exec("update opportunities set deleted_at=now()");
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" }); expect(await listLiveCatalogue()).toEqual([]);
});
it("requires two complete absences six hours apart and network errors never close a job", async () => {
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  vi.mocked(fetchPublicJobApi).mockRejectedValueOnce(Error("network"));
  await expect(runOfficialSourceIngestion({ sourceId: "jobs-whippy" })).rejects.toThrow();
  expect(await listLiveCatalogue()).toHaveLength(1);
  respond([]); await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  await completeScheduledSource("jobs-whippy", false);
  expect((await state.db!.query<{ paced: boolean }>("select next_crawl_at>=now()+interval '5 hours' as paced from official_sources where id='jobs-whippy'")).rows[0].paced).toBe(true);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" }); expect(await listLiveCatalogue()).toHaveLength(1);
  await state.db!.exec("update opportunities set job_missing_since=now()-interval '7 hours'");
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" }); expect(await listLiveCatalogue()).toHaveLength(0);
  expect((await state.db!.query<{ opportunity_status: string }>("select opportunity_status from opportunities")).rows[0].opportunity_status).toBe("closed");
});
it("stale verification is hidden by PostgreSQL RLS as well as catalogue SQL", async () => {
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  await state.db!.exec("update opportunities set last_source_check_at=now()-interval '49 hours'");
  expect(await listLiveCatalogue()).toEqual([]);
  const rows = await state.db!.transaction(async tx => { await tx.exec("set local role radar_reader"); return tx.query("select id from opportunities"); });
  expect(rows.rows).toEqual([]);
});
it("does not activate sources in the migration or publish unsupported eligibility", async () => {
  expect((await state.db!.query("select active,verification_status from official_sources where id='jobs-nortal'")).rows[0]).toEqual({ active: false, verification_status: "pending" });
  respond([{ ...fixture, title: "Forward Deployed Engineer", location: "Remote LATAM", descriptionPlain: "Build production integrations for LATAM customers." }]);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" }); expect(await listLiveCatalogue()).toEqual([]);
});
it("withdraws an explicitly hidden posting immediately", async () => {
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  respond([{ ...fixture, isListed: false }]);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" }); expect(await listLiveCatalogue()).toEqual([]);
});
it("legacy admin forms preserve employment proof and allow future automated metadata updates", async () => {
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  const [item] = await listLiveCatalogue(true);
  const input: Record<string, unknown> = { ...item, actor: "test:admin", officialSourceId: "jobs-whippy", requirementsText: "Requisito editado",
    isCourse: false, nationallyEligible: false, evidenceExcerpt: "Anúncio verificado no quadro oficial" };
  delete input.employment;
  await manageCatalogue("PATCH", input);
  respond([{ ...fixture, employmentType: "Contract" }]);
  await runOfficialSourceIngestion({ sourceId: "jobs-whippy" });
  const [current] = await listLiveCatalogue();
  expect(current.requirementsText).toBe("Requisito editado"); expect(current.employment.employmentType).toBe("Contract");
});
it("audits a job board without inventing national eligibility and activates only after explicit verification", async () => {
  await state.db!.exec("update official_sources set active=false,verification_status='pending' where id='jobs-whippy'");
  await expect(setEditorialSourceActive({ sourceId: "jobs-whippy", active: true })).rejects.toThrow();
  await verifyEditorialSource({ sourceId: "jobs-whippy", officialSource: true, locationConfirmed: true, collectionAllowed: true });
  const source = (await state.db!.query<{ active: boolean; geographic_scope: string[]; verification_status: string }>("select active,geographic_scope,verification_status from official_sources where id='jobs-whippy'")).rows[0];
  expect(source).toEqual({ active: false, geographic_scope: [], verification_status: "verified" });
  await setEditorialSourceActive({ sourceId: "jobs-whippy", active: true });
  expect(await runOfficialSourceIngestion({ sourceId: "jobs-whippy" })).toMatchObject({ published: 1 });
});
