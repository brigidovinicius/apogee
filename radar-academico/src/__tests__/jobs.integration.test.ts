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
import { runOfficialSourceIngestion } from "@/lib/ingestion";
import { fetchPublicJobApi } from "@/lib/ingestion/job-api";
import { listLiveCatalogue } from "@/lib/db/live-catalogue";
import { manageCatalogue } from "@/lib/official-sources/catalogue-management";
import { completeScheduledSource } from "@/lib/ingestion/official-source-registry";
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
