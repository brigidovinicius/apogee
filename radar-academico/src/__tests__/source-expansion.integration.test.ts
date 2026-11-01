import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
const state = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock("@/lib/db/client", () => ({ withAdminTransaction: (work: (client: PoolClient) => Promise<unknown>) =>
  state.db!.transaction(tx => work(tx as unknown as PoolClient)) }));
vi.mock("@/lib/ingestion/fetch-source", () => ({ fetchOfficialResource: vi.fn() }));
import { fetchOfficialResource } from "@/lib/ingestion/fetch-source";
import { runScheduledLeadProcessing } from "@/lib/discovery/process-leads";
import { isOfficialSourceUrl } from "@/lib/ingestion/validate-url";
import { loadActiveOfficialSources } from "@/lib/ingestion/official-source-registry";

const parent = "https://official.example.org/";
const target = "exp-source-expansion-test";
let url = parent + "calls/research";
let title = "Bolsa de pesquisa em tecnologia";
let deadline = "31/12/2099";
let parentHasLink = true;
let changeOrganizer = false;
const resource = (html: string) => ({ body: Buffer.from(html), contentType: "text/html",
  hash: createHash("sha256").update(html).digest("hex"), cached: false });

beforeAll(async () => {
  vi.stubEnv("DATABASE_EDITOR_URL", "postgresql://isolated-test.invalid/unused");
  state.db = new PGlite({ extensions: { pgcrypto } });
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith(".sql")).sort()) {
    await state.db.exec(await readFile(new URL(name, dir), "utf8"));
  }
  await state.db.query(`insert into discovery_targets(id,name,organizer,kind,official_url,evidence_url,
    enabled,official_verified_at,official_verified_url,official_verified_by,official_review_note,priority)
    values($1,'Chamadas oficiais','Instituto oficial','site',$2,$2,true,now(),$2,'test',
      'Autoria oficial e condições de consulta verificadas no teste.',60)`, [target, parent]);
}, 30000);
afterAll(async () => { await state.db?.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  url = parent + "calls/research"; title = "Bolsa de pesquisa em tecnologia";
  deadline = "31/12/2099"; parentHasLink = true; changeOrganizer = false;
  await state.db!.exec("delete from discovery_leads; delete from ingestion_runs; delete from opportunity_management_events; delete from opportunity_revisions; delete from opportunity_sources; delete from opportunities; delete from official_sources where id like 'auto-page-%' or id='disabled-test'");
  await state.db!.query("update discovery_targets set organizer='Instituto oficial' where id=$1", [target]);
  vi.mocked(fetchOfficialResource).mockImplementation(async requested => {
    if (requested === parent) return resource(parentHasLink ? `<main><a href="${url}">${title}</a></main>` : "<main>Sem chamada</main>");
    if (changeOrganizer) await state.db!.query("update discovery_targets set organizer='Operador alterou' where id=$1", [target]);
    return resource(`<article><h1>${title}</h1><p>Inscrições abertas até ${deadline}.</p>
      <p>Estudantes de graduação podem participar do processo seletivo. Inscreva-se pelo formulário de inscrição.</p></article>`);
  });
});

async function addLead(legacy = false) {
  await state.db!.query(`insert into discovery_leads(target_id,url,title,processing_status,processing_reason,processing_attempts)
    values($1,$2,$3,$4,$5,$6)`, [target, url, title, legacy ? "blocked" : "pending", legacy ? "scope_unverified" : null, legacy ? 1 : 0]);
}

it("recovers a legacy blocked link, registers one exact source and publishes atomically and idempotently", async () => {
  await addLead(true);
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 1, sourcesRegistered: 1, created: 1, published: 1 });
  const sources = (await loadActiveOfficialSources()).filter(source => source.id.startsWith("auto-page-"));
  expect(sources).toHaveLength(1);
  expect(isOfficialSourceUrl(url, sources)).toBe(true);
  expect(isOfficialSourceUrl(url + "/unverified", sources)).toBe(false);
  expect(isOfficialSourceUrl(url + "?other=1", sources)).toBe(false);
  expect(isOfficialSourceUrl(parent + "calls/another", sources)).toBe(false);
  expect((await state.db!.query("select review_status,publication_issue,verification_method from opportunities")).rows)
    .toEqual([{ review_status: "approved", publication_issue: null, verification_method: "automatic" }]);
  const audit = (await state.db!.query<{ execution_metadata: Record<string, unknown> }>(
    "select execution_metadata from ingestion_runs where execution_metadata->>'component'='discovery-lead'" )).rows[0].execution_metadata;
  expect(audit).toMatchObject({ sources_registered: 1, source_expansion_version: 1,
    source_registration: { targetUrl: parent, organizer: "Instituto oficial", pageHash: expect.stringMatching(/^[a-f0-9]{64}$/) } });
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0, sourcesRegistered: 0, published: 0 });
});

it("rolls back source registration when opportunity persistence fails", async () => {
  await state.db!.exec("alter table opportunities add constraint test_reject_title check(title not like 'Rollback%')");
  title = "Rollback bolsa de pesquisa";
  await addLead();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, created: 0, retried: 1 });
  expect((await state.db!.query("select id from official_sources where id like 'auto-page-%'")).rows).toHaveLength(0);
  expect((await state.db!.query("select id from opportunities")).rows).toHaveLength(0);
  await state.db!.exec("alter table opportunities drop constraint test_reject_title");
});

it("never shadows or reactivates an operator's disabled source", async () => {
  await state.db!.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
    allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
    values('disabled-test','Pausada','Instituto oficial','','official_reference',$1,
      array['official.example.org'],array['/calls/'],array[$1],'html',false,'verified')`, [parent + "calls/"]);
  await addLead();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0,
    reasons: { source_registration_conflict: 1 } });
  expect((await state.db!.query("select active from official_sources where id='disabled-test'")).rows).toEqual([{ active: false }]);
});

it("does not grant authority to another domain and does not fetch it", async () => {
  url = "https://another.example.org/bolsa";
  await addLead(true);
  vi.mocked(fetchOfficialResource).mockClear();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0,
    reasons: { source_authority_unverified: 1 } });
  expect(fetchOfficialResource).not.toHaveBeenCalled();
  expect(await runScheduledLeadProcessing()).toMatchObject({ leadsChecked: 0 });
});

it("requires the parent link to remain present before fetching the detail", async () => {
  parentHasLink = false;
  await addLead();
  vi.mocked(fetchOfficialResource).mockClear();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0,
    reasons: { source_link_missing: 1 } });
  expect(fetchOfficialResource).toHaveBeenCalledTimes(1);
});

it("rejects expired applications before registering a source", async () => {
  deadline = "31/12/2000";
  await addLead();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0,
    reasons: { invalid_deadline: 1 } });
});

it("discards source registration if an operator changes organizer identity during network I/O", async () => {
  changeOrganizer = true;
  await addLead();
  expect(await runScheduledLeadProcessing()).toMatchObject({ sourcesRegistered: 0, published: 0,
    reasons: { source_changed: 1 } });
});
