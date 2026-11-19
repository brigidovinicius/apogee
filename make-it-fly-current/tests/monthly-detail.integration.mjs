import assert from "node:assert/strict";
import { migrateMonthlyDetails } from "../scripts/monthly-detail-migrate.mjs";
import test from "node:test";
import { migrateMemberBenefits } from "../scripts/member-benefits-migrate.mjs";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberToolbox } from "../scripts/member-toolbox-migrate.mjs";
import { migrateMemberDeliverables } from "../scripts/member-deliverables-migrate.mjs";
import { recordBenefitCheck } from "../scripts/member-benefits-monitor.mjs";
import { seedBenefitsReview } from "../scripts/seed-benefits-review.mjs";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("real PostgreSQL conserves independent quotas under concurrency and renews by São Paulo month", async t => {
  const db = await nativeCommunityDatabase();
  t.after(db.close);
  for (const migrate of [migrateCommunityAccess, migrateMemberToolbox, migrateMemberDeliverables, migrateMemberBenefits]) {
    await migrate(db.sql, { apply: true, expectedRole: "apogee_local" });
  }
  const options = { expectedRole: "apogee_local" };
  assert.deepEqual(await migrateMonthlyDetails(db.sql, options), { changed: false, pending: true });
  assert.deepEqual(await migrateMonthlyDetails(db.sql, { ...options, apply: true }), { changed: true, pending: false });
  assert.deepEqual(await migrateMonthlyDetails(db.sql, { ...options, apply: true }), { changed: false, pending: false });
  for (const name of ["tester", "other", "revisaoadmin"]) {
    await db.sql`insert into "user"(id,name,email,email_verified,username) values(${name},${name},${name + "@example.test"},true,${name})`;
  }
  const previous = process.env.APOGEE_BENEFITS_REVIEW;
  process.env.APOGEE_BENEFITS_REVIEW = "1";
  try {
    await seedBenefitsReview(db.sql);
  } finally {
    if (previous === undefined) delete process.env.APOGEE_BENEFITS_REVIEW;
    else process.env.APOGEE_BENEFITS_REVIEW = previous;
  }

  const load = opportunityLoader({ "@/lib/members/db": { getSql: () => db.sql } });
  const { claimMonthlyDetail, monthlyDetailState } = load("lib/members/monthly-detail.ts");
  const { radarMonthlyState } = load("lib/opportunities/detail-store.ts");
  const { previewBenefitCatalogue } = load("lib/benefits/preview.ts");
  await db.sql`insert into member_monthly_detail_unlock(user_id,area,period,item_id)
    values('tester','radar',(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date,'previous-month')`;
  await db.sql`insert into radar_free_event(user_id,opportunity_id,slot) values('tester','legacy-item',1)`;

  const initial = await radarMonthlyState("tester");
  assert.deepEqual(initial.readableIds, ["legacy-item"]);
  assert.equal(initial.remaining, 10);
  const [{ renews }] = await db.sql`select to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month','YYYY-MM-DD') as renews`;
  assert.equal(initial.renewsOn, renews);
  await Promise.all(Array.from({ length: 13 }, (_, i) => claimMonthlyDetail("tester", "radar", "item-" + i)));
  const radar = await radarMonthlyState("tester");
  assert.equal(radar.remaining, 0);
  assert.equal(radar.used, 10);
  assert.equal(radar.readableIds.length, 11);
  assert.equal((await monthlyDetailState("other", "radar")).remaining, 10);
  await claimMonthlyDetail("tester", "radar", radar.ids[0]);
  assert.equal((await monthlyDetailState("tester", "radar")).used, 10);

  await claimMonthlyDetail("tester", "beneficios", "local-benefit-draft");
  assert.equal((await monthlyDetailState("tester", "beneficios")).remaining, 10);
  await claimMonthlyDetail("tester", "beneficios", "local-benefit-journey-1");
  await claimMonthlyDetail("tester", "beneficios", "local-benefit-journey-1");
  assert.equal((await monthlyDetailState("tester", "beneficios")).remaining, 9);
  await Promise.all(Array.from({ length: 11 }, (_, i) => claimMonthlyDetail("tester", "beneficios", "local-benefit-journey-" + (i + 2))));
  assert.equal((await monthlyDetailState("tester", "beneficios")).used, 10);

  const catalogue = await previewBenefitCatalogue({ query: "validacao 01", category: "", audience: "" });
  assert.equal(catalogue.offers.length, 1);
  assert.deepEqual(Object.keys(catalogue.offers[0]).sort(), ["audience", "category", "id", "name", "partner"]);

  // A recognizable partner can lead a tied feed without exposing redemption or ranking fields.
  await db.sql`update member_benefit set partner='Figma' where id='local-benefit-journey-12'`;
  const [revised] = await db.sql`select id,public.member_benefit_monitor_revision(b) as revision
    from member_benefit b where id='local-benefit-journey-12'`;
  await recordBenefitCheck(db.sql, { ...revised, checkedAt: new Date().toISOString() }, { outcome: "verified", reason: "Oferta sintética de teste" });
  const ranked = await previewBenefitCatalogue({ query: "Oferta de validação", category: "", audience: "" });
  assert.equal(ranked.offers[0].id, "local-benefit-journey-12");

  const offer = "local-benefit-journey-1";
  await db.sql`insert into member_monthly_detail_unlock(user_id,area,period,item_id)
    values('other','beneficios',(date_trunc('month', now() at time zone 'America/Sao_Paulo') - interval '1 month')::date,${offer})`;
  assert.equal((await monthlyDetailState("other", "beneficios")).remaining, 10);
  await Promise.all([claimMonthlyDetail("other", "beneficios", offer), claimMonthlyDetail("other", "beneficios", offer)]);
  assert.equal((await monthlyDetailState("other", "beneficios")).remaining, 9);
  assert.equal((await monthlyDetailState("other", "radar")).remaining, 10);
});
