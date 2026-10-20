import { readFile, readdir } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

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
