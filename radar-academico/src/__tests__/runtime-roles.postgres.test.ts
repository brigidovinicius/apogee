import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { OfficialSource, OpportunityCandidate } from "@/lib/ingestion/types";
import type { ProcessingLead } from "@/lib/discovery/process-leads";

const adminUrl = process.env.RADAR_ROLES_TEST_ADMIN_URL;
const suite = it.skipIf(!adminUrl);
let admin: pg.Pool;
let reader: pg.Pool;
let editor: pg.Pool;
const password = "synthetic-role-password-only";
const connection = (role: string) => {
  const url = new URL(adminUrl!); url.username = role; url.password = password;
  return url.toString();
};

beforeAll(async () => {
  if (!adminUrl) return;
  const url = new URL(adminUrl);
  if (url.hostname !== "127.0.0.1" || url.pathname !== "/radar_sec05_test" || url.username !== "postgres") {
    throw new Error("Somente PostgreSQL descartável local radar_sec05_test é permitido.");
  }
  admin = new pg.Pool({ connectionString: adminUrl, max: 1 });
  const exists = await admin.query("select to_regclass('public.opportunities') as name");
  if (exists.rows[0].name) throw new Error("Banco de teste não vazio; crie outro cluster descartável.");
  await admin.query(`create role radar_reader login nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication password '${password}';
    create role radar_editor login nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication password '${password}'`);
  const dir = new URL("../../db/migrations/", import.meta.url);
  for (const name of (await readdir(dir)).filter(name => name.endsWith(".sql")).sort()) {
    await admin.query("begin");
    try { await admin.query(await readFile(new URL(name, dir), "utf8")); await admin.query("commit"); }
    catch (error) { await admin.query("rollback"); throw error; }
  }
  await admin.query(`insert into official_sources
    (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status)
    values ('security-test','Instituto','Instituto','IF','federal_institute','https://example.edu.br/','{example.edu.br}','{/}','{https://example.edu.br/}','html',true,'verified');
    insert into opportunities
    (title,institution,applicant_type,application_route,benefit_type,deadline_precision,official_source_id,extraction_method,content_hash,canonical_key,requirements_text,amount_text,review_status,opportunity_status,verified_at,verification_method,published_at)
    values ('Visível','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','a','a','Estudantes','Não informado','approved','open',now(),'automatic',now()),
    ('Rascunho','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','b','b','Estudantes','Não informado','pending_review','open',null,null,null),
    ('Suspensa','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','c','c','Estudantes','Não informado','approved','suspended',now(),'automatic',now()),
    ('Rejeitada','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','d','d','Estudantes','Não informado','rejected','open',now(),'automatic',now()),
    ('Sem publicação','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','e','e','Estudantes','Não informado','approved','open',now(),'automatic',null),
    ('Expirada','Instituto','mixed','direct_student_application','other','continuous_flow','security-test','html','f','f','Estudantes','Não informado','approved','open',now(),'automatic',now());
    update opportunities set deadline_precision='exact_datetime',deadline_at=now()-interval '1 day' where title='Expirada';`);
  reader = new pg.Pool({ connectionString: connection("radar_reader"), max: 1 });
  editor = new pg.Pool({ connectionString: connection("radar_editor"), max: 1 });
  vi.stubEnv("DATABASE_READER_URL", connection("radar_reader"));
  vi.stubEnv("DATABASE_EDITOR_URL", connection("radar_editor"));
  // Regressão: a implementação antiga usa esta credencial privilegiada e ignora as duas URLs.
  vi.stubEnv("DATABASE_URL", adminUrl);
  vi.stubEnv("DATABASE_POOL_MAX", "1");
  vi.stubEnv("DATABASE_SSL", "false");
}, 30_000);

afterAll(async () => {
  await reader?.end(); await editor?.end(); await admin?.end(); vi.unstubAllEnvs();
});

suite("public queries use the reader login and cannot return draft or suspended rows", async () => {
  const { queryPublic } = await import("@/lib/db/client");
  const identity = await queryPublic("select current_user as name");
  expect(identity.rows[0].name).toBe("radar_reader");
  const result = await queryPublic("select title from opportunities where official_source_id=$1 order by title", ["security-test"]);
  expect(result.rows.map(row => row.title)).toEqual(["Visível"]);
});

suite("changing app.is_admin does not promote the reader or reveal private rows", async () => {
  await reader.query("select set_config('app.is_admin','true',false)");
  expect((await reader.query("select title from opportunities where official_source_id='security-test' order by title")).rows).toEqual([{ title: "Visível" }]);
  await expect(reader.query("set role radar_editor")).rejects.toMatchObject({ code: "42501" });
});

suite("reader cannot write, inspect subscriptions, truncate or change schema", async () => {
  for (const sql of [
    "update opportunities set title='forjado' where official_source_id='security-test'",
    "delete from opportunities where official_source_id='security-test'",
    "select email from opportunity_alert_subscriptions",
    "truncate opportunities cascade", "create table public.forbidden_reader(id int)",
    "alter table opportunities disable row level security", "create role forbidden_role",
  ]) await expect(reader.query(sql)).rejects.toMatchObject({ code: "42501" });
});

suite("editor writes require the explicit administrative transaction context", async () => {
  await expect(editor.query("insert into opportunity_alert_limits(key,count,resets_at) values ('unauthorized',1,now())"))
    .rejects.toMatchObject({ code: "42501" });
});

suite("editor can run authorized transactions but cannot own tables or issue DDL", async () => {
  const { withAdminTransaction } = await import("@/lib/db/client");
  const result = await withAdminTransaction(async client => {
    const identity = await client.query("select current_user as name");
    expect(identity.rows[0].name).toBe("radar_editor");
    return client.query("update opportunities set amount_text=$1 where official_source_id=$2 returning title", ["Atualizado", "security-test"]);
  });
  expect(result.rows).toHaveLength(6);
  for (const sql of ["truncate opportunities cascade", "alter table opportunities disable row level security", "create table public.forbidden_editor(id int)", "set role radar_owner"])
    await expect(editor.query(sql)).rejects.toMatchObject({ code: "42501" });
});

suite("failed editor transactions roll back without poisoning subsequent public reads", async () => {
  const { withAdminTransaction, queryPublic } = await import("@/lib/db/client");
  await expect(withAdminTransaction(async client => {
    await client.query("update opportunities set title='não persistir' where official_source_id='security-test'");
    throw new Error("abort-security-test");
  })).rejects.toThrow("abort-security-test");
  expect((await queryPublic("select title from opportunities where official_source_id='security-test'")).rows).toEqual([{ title: "Visível" }]);
});

suite("misconfigured privileged reader credentials are rejected before business queries", async () => {
  vi.resetModules(); vi.stubEnv("DATABASE_READER_URL", adminUrl!);
  const { queryPublic } = await import("@/lib/db/client");
  await expect(queryPublic("select title from opportunities")).rejects.toThrow("Privilégios de banco incompatíveis");
  vi.stubEnv("DATABASE_READER_URL", connection("radar_reader"));
});

suite("reader configuration cannot fall back to the editor or legacy superuser URL", async () => {
  vi.resetModules(); vi.stubEnv("DATABASE_READER_URL", "");
  const { queryPublic } = await import("@/lib/db/client");
  await expect(queryPublic("select title from opportunities")).rejects.toThrow("DATABASE_READER_URL");
});

suite("editor configuration cannot fall back to legacy superuser credentials", async () => {
  vi.resetModules(); vi.stubEnv("DATABASE_EDITOR_URL", "");
  const { withAdminTransaction } = await import("@/lib/db/client");
  await expect(withAdminTransaction(client => client.query("select current_user"))).rejects.toThrow("DATABASE_EDITOR_URL");
});

suite.each(["superuser", "bypassrls", "createdb", "createrole", "replication", "inherit"])(
  "an elevated %s reader is rejected even when the pool connection is reused", async flag => {
    vi.stubEnv("DATABASE_READER_URL", connection("radar_reader"));
    vi.resetModules(); const { queryPublic } = await import("@/lib/db/client");
    expect((await queryPublic("select current_user as name")).rows[0].name).toBe("radar_reader");
    await admin.query(`alter role radar_reader ${flag}`);
    try { await expect(queryPublic("select title from opportunities")).rejects.toThrow("Privilégios de banco incompatíveis"); }
    finally { await admin.query(`alter role radar_reader no${flag}`); }
  },
);

type LeadProcessingFixture = {
  source: OfficialSource;
  sourceId: string;
  targetId: string;
  leadIds: string[];
  processor: typeof import("@/lib/discovery/process-leads");
};

// No HTTP/extraction is invoked: candidates are supplied directly to the real
// transactional finalizer using the restricted runtime role and disposable DB.
async function withLeadProcessingFixture(work: (fixture: LeadProcessingFixture) => Promise<void>, count = 1) {
  const environmentKeys = ["DATABASE_READER_URL", "DATABASE_EDITOR_URL", "DATABASE_POOL_MAX", "DATABASE_SSL"];
  const previousEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  const suffix = randomUUID().slice(0, 8);
  const sourceId = `processing-source-${suffix}`;
  const targetId = `processing-target-${suffix}`;
  const officialUrl = `https://processing.example.edu.br/calls/${suffix}/`;
  const leadIds: string[] = [];
  vi.stubEnv("DATABASE_READER_URL", connection("radar_reader"));
  vi.stubEnv("DATABASE_EDITOR_URL", connection("radar_editor"));
  vi.stubEnv("DATABASE_POOL_MAX", "2");
  vi.stubEnv("DATABASE_SSL", "false");
  vi.resetModules();
  try {
    await admin.query(`insert into official_sources
      (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
       listing_urls,extraction_mode,active,verification_status)
      values($1,'Processing fixture','Processing fixture','FIX','federal_institute',$2,
       array['processing.example.edu.br'],array[$3],array[$2],'html',true,'verified')`,
    [sourceId, officialUrl, new URL(officialUrl).pathname]);
    await admin.query(`insert into discovery_targets
      (id,name,organizer,kind,official_url,evidence_url,enabled,official_verified_at,official_verified_url,
       official_verified_by,official_review_note)
      values($1,'Processing fixture','Processing fixture','site',$2,$2,true,now(),$2,'integration-test',
       'Synthetic official target for disposable PostgreSQL integration tests only.')`, [targetId, officialUrl]);
    for (let index = 0; index < count; index += 1) {
      const inserted = await admin.query<{ id: string }>(`insert into discovery_leads
        (target_id,url,title,processing_next_at,first_seen_at)
        values($1,$2,$3,'1900-01-01T00:00:00Z','1900-01-01T00:00:00Z') returning id`,
      [targetId, `${officialUrl}opportunity-${index}`, `Processing fixture opportunity ${index}`]);
      leadIds.push(inserted.rows[0].id);
    }
    const { loadOfficialSource } = await import("@/lib/ingestion/official-source-registry");
    const source = await loadOfficialSource(sourceId);
    if (!source) throw new Error("Synthetic processing source missing");
    const processor = await import("@/lib/discovery/process-leads");
    await work({ source, sourceId, targetId, leadIds, processor });
  } finally {
    try {
      // Delete only this fixture; aliases cascade, management events do not.
      await admin.query("delete from discovery_leads where target_id=$1", [targetId]);
      await admin.query(`delete from ingestion_runs where official_source_id=$1
        or execution_metadata->>'lead_id'=any($2::text[])`, [sourceId, leadIds]);
      await admin.query(`delete from opportunity_management_events where opportunity_id in
        (select id from opportunities where official_source_id=$1)`, [sourceId]);
      await admin.query("delete from opportunities where official_source_id=$1", [sourceId]);
      await admin.query("delete from discovery_targets where id=$1", [targetId]);
      await admin.query("delete from official_sources where id=$1", [sourceId]);
    } finally {
      for (const key of environmentKeys) {
        if (previousEnvironment[key] === undefined) delete process.env[key];
        else vi.stubEnv(key, previousEnvironment[key]!);
      }
      vi.resetModules();
    }
  }
}

function processingCandidate(lead: ProcessingLead, source: OfficialSource): OpportunityCandidate {
  return {
    officialSourceId: source.id, title: lead.title, institution: source.institutionName, sourcePageUrl: lead.url,
    applicantType: "mixed", applicationRoute: "direct_application", benefitType: "academic_scholarship",
    deadlineAt: "2100-12-31", deadlinePrecision: "date_only", requirementsText: "Synthetic requirements",
    amountText: "Synthetic conditions", stateCode: null, cityName: null, reviewStatus: "needs_information",
    opportunityStatus: "open", evidenceJson: {
      deadline_at: { source_url: lead.url, excerpt: "Inscrições até 31/12/2100" },
      opportunity_status: { source_url: lead.url, excerpt: "Inscrições abertas" },
    }, extractionMethod: "html", contentHash: `synthetic-${lead.id}`,
  };
}

suite("discovery claims use real editor RLS, skip locked rows and partition concurrent batches of two", async () => {
  await withLeadProcessingFixture(async ({ leadIds, processor }) => {
    const blocker = new pg.Client({ connectionString: connection("radar_editor") });
    await blocker.connect();
    try {
      await blocker.query("begin");
      await blocker.query("select set_config('app.is_admin','true',true)");
      await blocker.query("select id from discovery_leads where id=$1 for update", [leadIds[0]]);
      const [first, second] = await Promise.all([processor.claimDueDiscoveryLeads(), processor.claimDueDiscoveryLeads()]);
      expect(first).toHaveLength(2);
      expect(second).toHaveLength(2);
      const ids = [...first, ...second].map(lead => lead.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids).not.toContain(leadIds[0]);
      expect([...ids].sort()).toEqual(leadIds.slice(1).sort());
      expect(new Set([...first, ...second].map(lead => lead.processing_run_id)).size).toBe(4);
      const audit = await admin.query(`select status,count(*)::int as count from ingestion_runs
        where execution_metadata->>'lead_id'=any($1::text[]) group by status`, [ids]);
      expect(audit.rows).toEqual([{ status: "running", count: 4 }]);
    } finally {
      await blocker.query("rollback");
      await blocker.end();
    }
    await expect(reader.query("select processing_lease_token from discovery_leads")).rejects.toMatchObject({ code: "42501" });
  }, 5);
});

suite("discovery lease reclamation rejects a stale token and audits the expired attempt", async () => {
  await withLeadProcessingFixture(async ({ leadIds, processor }) => {
    const first = (await processor.claimDueDiscoveryLeads())[0];
    expect(first.id).toBe(leadIds[0]);
    await admin.query("update discovery_leads set processing_lease_until=now()-interval '1 second' where id=$1", [first.id]);
    const reclaimed = (await processor.claimDueDiscoveryLeads())[0];
    expect(reclaimed.id).toBe(first.id);
    expect(reclaimed.processing_lease_token).not.toBe(first.processing_lease_token);
    expect(reclaimed.processing_run_id).not.toBe(first.processing_run_id);
    expect(reclaimed.processing_attempts).toBe(2);
    expect(await processor.finishDiscoveryLead(first, { reason: "scope_unverified" })).toBeNull();
    expect(await processor.finishDiscoveryLead(reclaimed, { reason: "scope_unverified" }))
      .toMatchObject({ state: "blocked", reason: "scope_unverified" });
    const audit = await admin.query("select id,status,error_summary from ingestion_runs where id=any($1::uuid[])",
      [[first.processing_run_id, reclaimed.processing_run_id]]);
    expect(audit.rows.find(row => row.id === first.processing_run_id)).toMatchObject({ status: "failed", error_summary: "lease_expired" });
    expect(audit.rows.find(row => row.id === reclaimed.processing_run_id)).toMatchObject({ status: "completed_with_warnings", error_summary: "scope_unverified" });
  });
});

suite("discovery completion publishes once, is idempotent and retains a deleted opportunity", async () => {
  await withLeadProcessingFixture(async ({ source, sourceId, leadIds, processor }) => {
    const first = (await processor.claimDueDiscoveryLeads())[0];
    const candidate = processingCandidate(first, source);
    const published = await processor.finishDiscoveryLead(first, { source, candidate });
    expect(published).toMatchObject({ state: "completed", reason: "published", created: 1, published: 1 });
    const opportunityId = published!.opportunityId;
    expect((await admin.query("select status,processing_status,processing_opportunity_id from discovery_leads where id=$1", [first.id])).rows)
      .toEqual([{ status: "mapped", processing_status: "completed", processing_opportunity_id: opportunityId }]);
    expect((await reader.query("select id from opportunities where official_source_id=$1", [sourceId])).rows)
      .toEqual([{ id: opportunityId }]);
    expect(await processor.finishDiscoveryLead(first, { source, candidate })).toBeNull();
    expect((await processor.claimDueDiscoveryLeads()).some(lead => lead.id === first.id)).toBe(false);

    // Explicit reset of a synthetic fixture represents another processing attempt;
    // the existing canonical identity must survive, including its later tombstone.
    await admin.query(`update discovery_leads set status='new',processing_status='pending',processing_next_at='1900-01-01'
      where id=$1`, [leadIds[0]]);
    const again = (await processor.claimDueDiscoveryLeads())[0];
    expect(await processor.finishDiscoveryLead(again, { source, candidate }))
      .toMatchObject({ state: "completed", reason: "unchanged", created: 0, published: 0, opportunityId });
    expect((await admin.query("select count(*)::int as count from opportunities where official_source_id=$1", [sourceId])).rows[0].count).toBe(1);
    await admin.query("update opportunities set deleted_at=now() where id=$1", [opportunityId]);
    await admin.query(`update discovery_leads set status='new',processing_status='pending',processing_next_at='1900-01-01'
      where id=$1`, [leadIds[0]]);
    const deleted = (await processor.claimDueDiscoveryLeads())[0];
    expect(await processor.finishDiscoveryLead(deleted, { source, candidate }))
      .toMatchObject({ state: "ignored", reason: "deleted", created: 0, published: 0, opportunityId });
    expect((await admin.query("select deleted_at is not null as deleted from opportunities where id=$1", [opportunityId])).rows[0].deleted).toBe(true);
    expect((await reader.query("select id from opportunities where official_source_id=$1", [sourceId])).rows).toEqual([]);
  });
});

suite("a SQL failure during discovery completion rolls back the opportunity, events and lead together", async () => {
  await withLeadProcessingFixture(async ({ source, sourceId, processor }) => {
    const claimed = (await processor.claimDueDiscoveryLeads())[0];
    const candidate = processingCandidate(claimed, source);
    await admin.query(`create function public.processing_fixture_reject_completion() returns trigger language plpgsql as $body$
      begin
        if new.id::text=TG_ARGV[0] and new.processing_status='completed' then
          raise exception 'synthetic-finish-rollback';
        end if;
        return new;
      end; $body$`);
    try {
      await admin.query(`create trigger processing_fixture_reject_completion before update on discovery_leads
        for each row execute function public.processing_fixture_reject_completion('${claimed.id}')`);
      await expect(processor.finishDiscoveryLead(claimed, { source, candidate })).rejects.toThrow("synthetic-finish-rollback");
      expect((await admin.query("select count(*)::int as count from opportunities where official_source_id=$1", [sourceId])).rows[0].count).toBe(0);
      expect((await admin.query(`select count(*)::int as count from opportunity_management_events
        where new_data->'candidate'->>'officialSourceId'=$1`, [sourceId])).rows[0].count).toBe(0);
      expect((await admin.query("select processing_status,processing_lease_token from discovery_leads where id=$1", [claimed.id])).rows[0])
        .toEqual({ processing_status: "processing", processing_lease_token: claimed.processing_lease_token });
      expect((await admin.query("select status,items_created,finished_at from ingestion_runs where id=$1", [claimed.processing_run_id])).rows[0])
        .toEqual({ status: "running", items_created: 0, finished_at: null });
    } finally {
      await admin.query("drop trigger if exists processing_fixture_reject_completion on discovery_leads");
      await admin.query("drop function public.processing_fixture_reject_completion()");
    }
    expect(await processor.finishDiscoveryLead(claimed, { source, candidate })).toMatchObject({ state: "completed", created: 1 });
  });
});

suite("a corrected discovery target requeues its blocked lead and validates it again before publication", async () => {
  await withLeadProcessingFixture(async ({ source, targetId, processor }) => {
    const first = (await processor.claimDueDiscoveryLeads())[0];
    await admin.query("update discovery_targets set enabled=false where id=$1", [targetId]);
    expect(await processor.finishDiscoveryLead(first, { source, candidate: processingCandidate(first, source) }))
      .toMatchObject({ state: "blocked", reason: "target_unavailable" });
    await admin.query("update discovery_targets set enabled=true where id=$1", [targetId]);
    const { withAdminTransaction } = await import("@/lib/db/client");
    const { requeueDiscoveryLeads } = await import("@/lib/discovery/watchlist");
    expect(await withAdminTransaction(client => requeueDiscoveryLeads(client, { targetId, reason: "configuration_changed" }))).toBe(1);
    const retried = (await processor.claimDueDiscoveryLeads())[0];
    expect(retried.processing_lease_token).not.toBe(first.processing_lease_token);
    expect(await processor.finishDiscoveryLead(retried, { source, candidate: processingCandidate(retried, source) }))
      .toMatchObject({ state: "completed", created: 1 });
    expect(await withAdminTransaction(client => requeueDiscoveryLeads(client, { leadId: first.id, reason: "manual_recheck" }))).toBe(0);
    expect((await admin.query("select count(*)::int as count from ingestion_runs where execution_metadata->>'component'='discovery-requeue' and execution_metadata->>'lead_id'=$1", [first.id])).rows[0].count).toBe(1);
  });
});
suite("rediscovery rechecks semantic blocks at most daily without restarting exhausted retries or dismissals", async () => {
  await withLeadProcessingFixture(async ({ leadIds }) => {
    const { withAdminTransaction } = await import("@/lib/db/client");
    const { requeueDiscoveryLeads } = await import("@/lib/discovery/watchlist");
    await admin.query("update discovery_leads set processing_status='blocked',processing_reason='retry_exhausted',processing_attempts=4,processed_at=now()-interval '2 days' where id=$1", [leadIds[0]]);
    const daily = () => withAdminTransaction(client => requeueDiscoveryLeads(client, { leadId: leadIds[0], reason: "rediscovered" }));
    expect(await daily()).toBe(0);
    await admin.query("update discovery_leads set processing_reason='scope_unverified' where id=$1", [leadIds[0]]);
    expect(await daily()).toBe(1);
    await admin.query("update discovery_leads set processing_status='blocked',processing_reason='candidate_unconfirmed',processed_at=now() where id=$1", [leadIds[0]]);
    expect(await daily()).toBe(0);
    await admin.query("update discovery_leads set status='dismissed',processed_at=now()-interval '2 days' where id=$1", [leadIds[0]]);
    expect(await daily()).toBe(0);
    expect(await withAdminTransaction(client => requeueDiscoveryLeads(client, { leadId: leadIds[0], reason: "manual_recheck" }))).toBe(0);
  });
});
