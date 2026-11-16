import assert from "node:assert/strict";
import test from "node:test";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberToolbox } from "../scripts/member-toolbox-migrate.mjs";
import { migrateMemberDeliverables } from "../scripts/member-deliverables-migrate.mjs";
import { communityLaunchMetrics } from "../scripts/community-launch-metrics.mjs";

test("launch report is read-only, aggregate, mode-bound and distinguishes normalization from cash and unmeasured cohorts", async () => {
  const db = await nativeCommunityDatabase(), sql = db.sql;
  try {
    await migrateCommunityAccess(sql, { apply: true, expectedRole: "apogee_local" });
    await migrateMemberToolbox(sql, { apply: true, expectedRole: "apogee_local" });
    await migrateMemberDeliverables(sql, { apply: true, expectedRole: "apogee_local" });
    for (const id of ["paid", "free", "legacy", "admin", "blocked", "unverified", "expired", "refund", "test-only"]) {
      await sql`insert into "user"(id,name,email,email_verified,role,blocked,created_at) values(${id},'PRIVATE_SYNTHETIC_NAME',${id === "test-only" ? "synthetic@example.test" : id + "@fixture.testdata"},${id !== "unverified"},${id === "admin" ? "admin" : "member"},${id === "blocked"},'2026-11-09T12:00:00Z')`;
    }
    await sql`insert into radar_legacy_access(user_id) values('legacy')`;
    for (const [id,mode,status,end] of [["paid",false,"paid","2027-11-10"],["admin",false,"paid","2027-11-10"],["blocked",false,"paid","2027-11-10"],["expired",false,"paid","2026-11-11"],["refund",false,"refunded","2027-11-10"],["test-only",true,"paid","2027-11-10"]]) {
      await sql`insert into community_subscription(id,user_id,customer_id,livemode,status,cancel_at_period_end) values(${"sub_" + id},${id},${"cus_" + id},${mode},'active',${id === "paid"})`;
      await sql`insert into community_invoice(id,subscription_id,amount,currency,period_start,period_end,status) values(${"in_" + id},${"sub_" + id},143880,'brl','2026-11-10',${end},${status})`;
    }
    await sql`insert into radar_free_event(user_id,opportunity_id,slot,opened_at) values('free','PRIVATE_EVENT_ID',1,'2026-11-10T12:00:00Z')`;
    const probe = { begin: (options, callback) => sql.begin(options, async tx => {
      const [settings] = await tx`select current_setting('transaction_read_only') as read_only`;
      assert.equal(settings.read_only, "on");return callback(tx);
    }) };
    const options = { from: "2026-11-09", to: "2026-11-16", asOf: "2026-11-15T23:00:00Z", mode: "test" };
    const [before] = await sql`select count(*)::int as n from community_invoice`;
    const report = await communityLaunchMetrics(probe, options);
    assert.equal(report.readOnly,true);assert.equal(report.synthetic,true);
    assert.equal(report.counts.annual_accounts_current,1);
    assert.equal(report.counts.active_accounts_renewal_cancelled,1);
    assert.equal(report.counts.verified_accounts_created,6);
    assert.equal(report.counts.free_cohort_accounts,5);
    assert.equal(report.counts.first_event_same_week,1);
    assert.equal(report.normalizedAnnualCents,143880);assert.equal(report.normalizedMonthlyCents,11990);
    for (const key of ["cashReceivedCents","conversion30Days","activation7Days","returnDays8To14","churn"]) assert.equal(report[key],null,key);
    assert.equal(report.counts.event_orientation_requests,null);assert.equal(report.consentedDailyBehavior,null);
    const live = await communityLaunchMetrics(probe, { ...options,mode:"live" });
    assert.equal(live.counts.annual_accounts_current,0,"test identity with a live-shaped fixture is never a live payer");
    assert.doesNotMatch(JSON.stringify(report),/PRIVATE_SYNTHETIC_NAME|PRIVATE_EVENT_ID|fixture.testdata|synthetic@example.test|sub_paid/);
    const [after] = await sql`select count(*)::int as n from community_invoice`;assert.equal(after.n,before.n);
    await assert.rejects(communityLaunchMetrics(probe,{...options,mode:"unknown"}));
    await assert.rejects(communityLaunchMetrics(probe,{...options,from:"2026-02-31"}));
  } finally { await db.close(); }
});
