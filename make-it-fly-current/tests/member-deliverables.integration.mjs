import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberDeliverables } from "../scripts/member-deliverables-migrate.mjs";
let db, sql, store, actor = "admin", validations, load;
const users = ["admin", "free0", "free9", "free10", "legacy", "paid", "cancelled", "expired", "refunded", "other", "blocked"];
const benefit = { name: "BENEFIT_PRIVATE_FIXTURE", partner: "Synthetic partner", description: "Synthetic agreement for isolation test only", evidenceUrl: "https://example.org/agreement", eligibility: "Annual account", availability: "One use per account, verified by the fixture partner", startsAt: "2026-01-01", endsAt: "2099-01-01", redemption: "Follow the confirmed partner instructions", redemptionUrl: "https://example.org/redeem", status: "published", sortOrder: 1 };
before(async () => {
  db = await nativeCommunityDatabase(); sql = db.sql;
  await migrateCommunityAccess(sql, { apply: true, expectedRole: "apogee_local" });
  // Apply the reviewed toolbox predecessor, without using or modifying any other worktree DB.
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")).entries;
  const predecessor = journal[19], source = await readFile(new URL(`../drizzle/${predecessor.tag}.sql`, import.meta.url), "utf8");
  await sql.unsafe(source);
  await sql`insert into drizzle.__drizzle_migrations(hash,created_at) values(${createHash("sha256").update(source).digest("hex")},${predecessor.when})`;
  for (const id of users) await sql`insert into "user"(id,name,email,email_verified,role,adult_declared,blocked) values(${id},'Pessoa Sintética',${id + "@example.test"},true,${id === "admin" ? "admin" : "member"},true,${id === "blocked"})`;
  process.env.STRIPE_MODE = "test";
  load = opportunityLoader({ "@/lib/members/db": { getSql: () => sql }, "@/lib/members/dal": {
    requireMember: async () => { if (!actor || actor === "blocked") throw Error("AUTH"); return { id: actor, role: actor === "admin" ? "admin" : "member" }; },
    requireAdmin: async () => { if (actor !== "admin") throw Error("ADMIN"); return { id: actor, role: "admin" }; },
  } });
  store = load("lib/deliverables/store.ts"); validations = load("lib/deliverables/validation.ts");
});
after(async () => { await db?.close(); });
test("additive migration preflight, apply, repeat, wrong-role and drift refusal", async () => {
  assert.equal((await migrateMemberDeliverables(sql, { expectedRole: "apogee_local" })).pending, true);
  assert.equal((await migrateMemberDeliverables(sql, { apply: true, expectedRole: "apogee_local" })).changed, true);
  assert.equal((await migrateMemberDeliverables(sql, { apply: true, expectedRole: "apogee_local" })).changed, false);
  await assert.rejects(migrateMemberDeliverables(sql, { expectedRole: "apogee_app" }), /Papel/);
  await sql`alter table member_benefit add column unexpected text`;
  await assert.rejects(migrateMemberDeliverables(sql, { expectedRole: "apogee_local" }), /Colunas/);
  await sql`alter table member_benefit drop column unexpected`;
});
test("editorial validation refuses unsafe destinations and benefits lacking confirmed conditions", () => {
  for (const url of ["http://google.com", "javascript:alert(1)", "https://user:pass@google.com", "https://127.0.0.1", "https://[::1]", "https://internal.local", "https://google.com?token=x", "https://google.com#secret", "https://google.com:8443", "https://google.com\\@evil.com"]) assert.equal(validations.officialUrl.safeParse(url).success, false, url);
  assert.equal(validations.officialUrl.safeParse("https://labs.google/fx/tools/flow").success, true);
  for (const key of ["evidenceUrl", "eligibility", "availability", "startsAt", "endsAt", "redemption"]) assert.equal(validations.benefitSchema.safeParse({ ...benefit, [key]: "" }).success, false, key);
  assert.equal(validations.benefitSchema.safeParse({ ...benefit, endsAt: "2025-01-01" }).success, false);
  assert.equal(validations.benefitSchema.safeParse({ ...benefit, startsAt: "2026-02-31" }).success, false);
});
let benefitId, trackId, moduleId, activityId;
test("protected editorial creation, ordering, updating, publication and audit persist in real DB", async () => {
  benefitId = await store.saveDeliverable("benefit", benefit);
  trackId = await store.saveDeliverable("track", { name: "TRACK_PRIVATE_FIXTURE", description: "Original synthetic exercise", status: "published", sortOrder: 1 });
  moduleId = await store.saveDeliverable("module", { trackId, name: "Module fixture", description: "Test task", deliverable: "A verified task outline", status: "published", sortOrder: 1 });
  activityId = await store.saveDeliverable("activity", { moduleId, name: "ACTIVITY_PRIVATE_FIXTURE", instructions: "PRIVATE_INSTRUCTIONS: choose a task and check your result", resourceUrl: "", status: "published", sortOrder: 1 });
  await store.saveDeliverable("benefit", { ...benefit, id: benefitId, sortOrder: 7 });
  assert.equal((await store.adminDeliverables()).benefits[0].sort_order, 7);
  const [audit] = await sql`select count(*)::int as n from member_deliverable_audit`; assert.equal(audit.n, 5);
  actor = "free0"; await assert.rejects(store.adminDeliverables(), /ADMIN/); await assert.rejects(store.saveDeliverable("benefit", benefit), /ADMIN/);
});
test("all required profiles get only their annual rights; legacy and administrative roles alone grant no paid catalogue", async () => {
  for (const id of ["paid", "cancelled", "expired", "refunded", "blocked"]) {
    await sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values(${"sub_" + id},${id},${"cus_" + id},false,'active',${id === "cancelled"})`;
    await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status) values(${"in_" + id},${"sub_" + id},143880,'brl',now()-interval '1 year',${id === "expired" ? new Date(Date.now() - 10000) : new Date(Date.now() + 86400000)},${id === "refunded" ? "refunded" : "paid"})`;
  }
  await sql`insert into radar_legacy_access(user_id) values('legacy')`;
  for (const id of ["free9", "free10"]) for (let i = 1; i <= (id === "free9" ? 9 : 10); i++) await sql`insert into radar_free_event(user_id,opportunity_id,slot) values(${id},${"fixture-event-" + i},${i})`;
  for (actor of ["free0", "free9", "free10", "legacy", "expired", "refunded", "admin", "other"]) {
    const b = await store.memberBenefits(), t = await store.memberLearning();
    assert.equal(b.access.active, false, actor); assert.deepEqual(b.benefits, [], actor);
    assert.deepEqual(t.activities, [], actor); assert.deepEqual(t.tracks, [], actor);
    assert.ok(!JSON.stringify({ b, t }).includes("PRIVATE_FIXTURE"), actor);
  }
  for (actor of ["paid", "cancelled"]) { assert.equal((await store.memberBenefits()).benefits.length, 1); assert.equal((await store.memberLearning()).activities.length, 1); }
  actor = null; await assert.rejects(store.memberBenefits(), /AUTH/);
  actor = "blocked"; await assert.rejects(store.memberLearning(), /AUTH/);
});
test("private progress is idempotent, account-bound, restricted on expiry and independent of the Radar quota", async () => {
  actor = "paid";
  const [before] = await sql`select count(*)::int as n from radar_free_event`;
  await Promise.all(Array.from({ length: 6 }, () => store.setLearningProgress({ activityId, completed: true })));
  const [count] = await sql`select count(*)::int as n from member_learning_progress where user_id='paid'`; assert.equal(count.n, 1);
  assert.ok((await store.memberLearning()).activities[0].completed_at);
  actor = "cancelled"; assert.equal((await store.memberLearning()).activities[0].completed_at, null);
  await assert.rejects(store.setLearningProgress({ activityId, completed: true, userId: "paid" }));
  actor = "free0"; await assert.rejects(store.setLearningProgress({ activityId, completed: true }), /anual/);
  actor = "paid"; await store.setLearningProgress({ activityId, completed: false });
  assert.equal((await store.memberLearning()).activities[0].completed_at, null);
  await sql`update community_invoice set status='fraud',fraud_review_required=true where id='in_paid'`;
  await assert.rejects(store.setLearningProgress({ activityId, completed: true }), /anual/);
  await sql`update community_invoice set status='paid',fraud_review_required=false where id='in_paid'`;
  const [after] = await sql`select count(*)::int as n from radar_free_event`; assert.equal(before.n, after.n);
});
test("draft/archive/expiry and parent publication apply to direct reads and progress writes", async () => {
  actor = "admin"; await store.saveDeliverable("benefit", { ...benefit, id: benefitId, status: "archived" });
  await sql`update member_learning_module set status='preparing' where id=${moduleId}`;
  actor = "paid"; assert.equal((await store.memberBenefits()).benefits.length, 0);
  let t = await store.memberLearning(); assert.equal(t.modules[0].status, "preparing"); assert.equal(t.modules[0].description, ""); assert.equal(t.activities.length, 0);
  await assert.rejects(store.setLearningProgress({ activityId, completed: true }), /indisponível/);
  await sql`update member_learning_module set status='published' where id=${moduleId}`;
  await sql`update member_learning_track set status='archived' where id=${trackId}`;
  t = await store.memberLearning(); assert.equal(t.modules.length, 0); assert.equal(t.activities.length, 0);
  await sql`update member_benefit set status='published',ends_at=now()-interval '1 day' where id=${benefitId}`;
  assert.equal((await store.memberBenefits()).benefits.length, 0);
});
test("synthetic backup restores schema, quotas and legacy rights without modifying the source", async () => {
  const bin = process.env.PG_BIN ?? "/opt/homebrew/bin", dump = path.join(db.dir, "offer.dump");
  execFileSync(path.join(bin, "pg_dump"), ["-Fc", "-f", dump, db.url], { stdio: "ignore" });
  await sql.unsafe("create database offer_restore");
  const destination = db.url.replace(/\/postgres$/, "/offer_restore");
  execFileSync(path.join(bin, "pg_restore"), ["--exit-on-error", "--no-owner", "-d", destination, dump], { stdio: "ignore" });
  const restored = (await import("postgres")).default(destination, { ssl: false, prepare: false });
  try {
    for (const table of ["radar_free_event", "radar_legacy_access", "member_learning_progress", "member_benefit", "member_deliverable_audit"]) {
      const a = await sql.unsafe(`select count(*)::int as n from ${table}`), b = await restored.unsafe(`select count(*)::int as n from ${table}`); assert.equal(a[0].n, b[0].n, table);
    }
    assert.equal((await migrateMemberDeliverables(restored, { expectedRole: "apogee_local" })).changed, false);
  } finally { await restored.end(); }
});
test("nine released events and two concurrent requests allow only the tenth", async () => {
  const detail = load("lib/opportunities/detail-store.ts");
  const results = await Promise.all([detail.claimFreeRadarEvent("free9", "fixture-extra-a", null), detail.claimFreeRadarEvent("free9", "fixture-extra-b", null)]);
  assert.equal(results.filter(Boolean).length, 1);
  const [row] = await sql`select count(*)::int as n from radar_free_event where user_id='free9'`; assert.equal(row.n, 10);
});
test("event and drop persist separate purposes; duplicate retries preserve evidence and create no account or subscription", async () => {
  await sql.unsafe(await readFile(new URL("../sql/community-contacts.sql", import.meta.url), "utf8"));
  process.env.BETTER_AUTH_SECRET = "synthetic-local-secret-that-is-longer-than-32-characters";
  const routeLoad = opportunityLoader({ "@/lib/members/db": { getSql: () => sql }, "@/lib/members/client-ip": { memberClientIp: () => "127.0.0.1" }, "@/lib/members/rate-limit": { consumeRateLimit: async () => true } });
  const post = (url, body, origin = "https://apogee.test") => new Request(`https://apogee.test${url}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
  const contact = routeLoad("app/api/comunidade/contatos/route.ts").POST;
  const drop = routeLoad("app/api/loja/novidades/route.ts").POST;
  const payload = { campaign: "codex", name: "Pessoa Sintética", email: "lead@example.test", goal: "Fixture", consent: true, website: "" };
  const [before] = await sql`select count(*)::int as n from "user"`;
  assert.equal((await contact(post("/api/comunidade/contatos", { ...payload, consent: false }))).status, 400);
  assert.equal((await contact(post("/api/comunidade/contatos", payload, "https://evil.test"))).status, 403);
  assert.equal((await contact(post("/api/comunidade/contatos", payload))).status, 200);
  assert.equal((await contact(post("/api/comunidade/contatos", { ...payload, name: "Different" }))).status, 200);
  assert.equal((await drop(post("/api/loja/novidades", { name: "Pessoa Sintética", phone: "12345678901", email: payload.email, consent: true }))).status, 200);
  const rows = await sql`select name,consent_version,consent_text from community_contact where email='lead@example.test'`;
  assert.equal(rows.length, 1); assert.equal(rows[0].name, payload.name); assert.ok(rows[0].consent_version); assert.ok(rows[0].consent_text);
  const [signup] = await sql`select consent_text from store_drop_signup where email='lead@example.test'`; assert.notEqual(signup.consent_text, rows[0].consent_text);
  const [after] = await sql`select count(*)::int as n from "user"`; assert.equal(after.n, before.n);
  assert.equal((await sql`select id from community_subscription where user_id='lead@example.test'`).length, 0);
});
test("event operations normalize the shared Drizzle driver's raw timestamp before rendering", async () => {
  drizzle(sql);
  const contacts = opportunityLoader({"@/lib/members/db":{getSql:()=>sql},"./access":{requireAdmin:async()=>({id:"admin"})}})("lib/admin/community-contacts.ts");
  const result = await contacts.listCommunityContacts("1");
  assert.equal(result.total,1);assert.equal(result.rows[0].email,"lead@example.test");
  assert.ok(result.rows[0].consented_at instanceof Date);
  assert.match(result.rows[0].consented_at.toISOString(),/^\d{4}-/);
});
