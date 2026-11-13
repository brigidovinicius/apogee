import assert from "node:assert/strict";
import { test } from "node:test";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { mcpTestDatabase } from "./helpers/mcp-test-database.mjs";

test("account tools use real SQL ownership, current access and feature gates without leaking snapshots", { timeout: 30_000 }, async t => {
  const original = { ...process.env };
  Object.assign(process.env, { RADAR_CALENDAR_PERSONAL_ENABLED: "true", RADAR_COLLECTIONS_ENABLED: "true", STRIPE_MODE: "test" });
  const database = await mcpTestDatabase({ accountTables: true });
  const state = { active: true, adult: true, reads: [], sync: [], invalidated: [] };
  const item = { id: "radar-synthetic", title: "Oportunidade atual", organization: "Instituição", summary: "Resumo", categories: ["competicoes"],
    kind: "Programa", level: "Graduação", location: "Online", benefit: "Apoio", deadline: "2099-12-31", deadlineLabel: "Até dezembro", verifiedAt: "2026-11-13",
    eligibility: "PRIVATE_ELIGIBILITY", officialUrl: "https://source.synthetic.test/private" };
  const load = opportunityLoader({
    "@/lib/members/db": { getDb: () => database.db, getSql: () => database.sql },
    "./db": { getDb: () => database.db, getSql: () => database.sql },
    "@/lib/members/mail": { applicationOrigin: () => "https://www.apogee.community" },
    "@/lib/members/protection": { adultAccess: async () => state.adult },
    "@/lib/billing/store": { radarAccess: async (id, mode, options) => { state.reads.push({ id, mode, options }); return { active: state.active }; } },
    "./radar-client": { listRadarOpportunities: async () => [item] },
    "@/lib/opportunities/radar-client": { listRadarOpportunities: async () => [item] },
    "@/lib/opportunities/google-calendar-store": { queueGoogleCalendarSync: async id => { state.sync.push(id); return true; } },
    "next/cache": { revalidatePath: path => state.invalidated.push(path) },
  });
  const run = load("lib/mcp/account.ts").runAccountTool;
  try {
    await database.pg.exec(`insert into "user"(id,name,email,username,bio) values
      ('a','Pessoa A','private-a@synthetic.test','pessoa_a','Minha bio'),('b','Pessoa B','private-b@synthetic.test','pessoa_b','Bio B');`);
    await t.test("own profile returns only approved fields and rejects injected identity", async () => {
      const profile = await run("a", "get_account_profile", {});
      assert.deepEqual(Object.keys(profile).sort(), ["apogeeUrl", "bio", "name", "username"]);
      assert.equal(profile.name, "Pessoa A"); assert.ok(!JSON.stringify(profile).includes("private-a"));
      await assert.rejects(run("a", "get_account_profile", { userId: "b" }), error => error.code === "invalid_arguments");
    });
    await t.test("calendar changes are isolated, idempotent and use live data", async () => {
      await database.sql`insert into radar_saved_opportunity(user_id,opportunity_id,snapshot) values ('b','radar-synthetic',${JSON.stringify({ title: "SECRET_SNAPSHOT_B" })}::jsonb)`;
      const result = await run("a", "set_calendar_opportunity", { opportunityId: item.id, saved: true });
      assert.equal(result.saved, true); assert.equal(result.syncPending, true); assert.deepEqual(state.sync, ["a"]);
      await run("a", "set_calendar_opportunity", { opportunityId: item.id, saved: true });
      await database.sql`update radar_saved_opportunity set snapshot=${JSON.stringify({ title: "SECRET_HISTORY", officialUrl: "SECRET_URL" })}::jsonb where user_id='a'`;
      const list = await run("a", "list_my_calendar", {});
      assert.equal(list.total, 1); assert.equal(list.items[0].opportunity.title, item.title);
      assert.ok(!JSON.stringify(list).includes("SECRET_")); assert.ok(!JSON.stringify(list).includes("PRIVATE_ELIGIBILITY"));
      await run("a", "set_calendar_opportunity", { opportunityId: item.id, saved: false });
      assert.equal((await run("a", "list_my_calendar", {})).total, 0);
      assert.equal((await database.pg.query("select count(*)::int as n from radar_saved_opportunity where user_id='b' and removed_at is null")).rows[0].n, 1);
    });
    let a, b;
    await t.test("collections are private, bounded and owned; partial updates preserve fields", async () => {
      a = await run("a", "create_collection", { name: "Minha coleção", description: "Preservar descrição", cover: "oceano" });
      b = await run("b", "create_collection", { name: "Coleção de B" });
      await run("a", "set_collection_opportunity", { collectionId: a.id, opportunityId: item.id, present: true });
      await run("a", "set_collection_opportunity", { collectionId: a.id, opportunityId: item.id, present: true });
      const updated = await run("a", "update_collection", { collectionId: a.id, name: "Novo nome" });
      assert.equal(updated.collection.description, "Preservar descrição"); assert.equal(updated.collection.cover, "oceano");
      assert.equal(updated.collection.itemCount, 1);
      // Suspend both calls after they read the same old collection. Each edit
      // must preserve the other call's omitted field when writes resume.
      const collectionDal = load("lib/opportunities/collections.ts");
      const originalOwned = collectionDal.ownedCollection;
      let reads = 0, release;
      const bothRead = new Promise(resolve => { release = resolve; });
      collectionDal.ownedCollection = async (...args) => {
        const result = await originalOwned(...args);
        if (++reads <= 2) { if (reads === 2) release(); await bothRead; }
        return result;
      };
      try {
        await Promise.all([
          run("a", "update_collection", { collectionId: a.id, name: "Nome concorrente" }),
          run("a", "update_collection", { collectionId: a.id, description: "Descrição concorrente" }),
        ]);
        const result = await originalOwned("a", a.id);
        assert.equal(result.name, "Nome concorrente"); assert.equal(result.description, "Descrição concorrente");
        assert.equal(result.cover, "oceano");
      } finally { collectionDal.ownedCollection = originalOwned; }
      await database.sql`update radar_calendar_collection set visibility='unlisted',share_token=${"f".repeat(48)} where id=${a.id}`;
      const detail = await run("a", "get_my_collection", { collectionId: a.id, pageSize: 1 });
      assert.equal(detail.items.length, 1); assert.ok(!JSON.stringify(detail).includes("f".repeat(48)));
      assert.equal(detail.collection.shared, true);
      assert.ok(!Object.hasOwn(detail.collection, "shareVersion"));
      const list = await run("a", "list_my_collections", {});
      assert.deepEqual(list.items.map(i => i.id), [a.id]); assert.ok(!JSON.stringify(list).includes("Coleção de B"));
      for (const [tool, args] of [
        ["get_my_collection", {}], ["update_collection", { name: "Invadida" }],
        ["set_collection_opportunity", { opportunityId: item.id, present: true }],
      ]) await assert.rejects(run("a", tool, { collectionId: b.id, ...args }), error => error.code === "not_found");
      await run("a", "set_collection_opportunity", { collectionId: a.id, opportunityId: item.id, present: false });
      assert.equal((await run("a", "get_my_collection", { collectionId: a.id })).total, 0);
      for (let i = 1; i < 20; i++) await run("a", "create_collection", { name: "Coleção " + i });
      await assert.rejects(run("a", "create_collection", { name: "Excedente" }), error => error.code === "invalid_arguments");
    });
    await t.test("entitlement loss, protection, feature flags and blocked accounts stop later calls", async () => {
      state.active = false;
      for (const [tool, args] of [["list_my_calendar", {}], ["set_calendar_opportunity", { opportunityId: item.id, saved: true }],
        ["update_collection", { collectionId: a.id, name: "Bloqueada" }]]) {
        await assert.rejects(run("a", tool, args), error => error.code === "access_required");
      }
      assert.equal((await run("a", "get_account_profile", {})).name, "Pessoa A", "profile does not require paid Radar");
      state.active = true; state.adult = false;
      await assert.rejects(run("a", "get_account_profile", {}), error => error.code === "access_required");
      state.adult = true; process.env.RADAR_COLLECTIONS_ENABLED = "false";
      await assert.rejects(run("a", "list_my_collections", {}), error => error.code === "feature_unavailable");
      process.env.RADAR_COLLECTIONS_ENABLED = "true"; process.env.RADAR_CALENDAR_PERSONAL_ENABLED = "false";
      await assert.rejects(run("a", "list_my_calendar", {}), error => error.code === "feature_unavailable");
      await database.pg.exec("update \"user\" set blocked=true where id='a'");
      await assert.rejects(run("a", "get_account_profile", {}), error => error.code === "account_unavailable");
      assert.ok(state.reads.every(call => call.mode === false && call.options.claimPurchases === false));
    });
  } finally { await database.close(); process.env = original; }
});
