import assert from "node:assert/strict";
import { migrateCommunityAccess } from "../scripts/community-access-migrate.mjs";
import { migrateMemberToolbox } from "../scripts/member-toolbox-migrate.mjs";
import { migrateMemberDeliverables } from "../scripts/member-deliverables-migrate.mjs";
import { migrateMemberBenefits } from "../scripts/member-benefits-migrate.mjs";
import { migrateMonthlyDetails } from "../scripts/monthly-detail-migrate.mjs";
import { migrateWorkshopVouchers } from "../scripts/workshop-voucher-migrate.mjs";
import { test } from "node:test";
import { nativeCommunityDatabase } from "./helpers/community-native-db.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const loadInput = opportunityLoader();
const { parseVoucherGuests, parseVoucherLinks, VOUCHER_PATH } = loadInput("lib/workshop-voucher/input.ts");
const links = Array.from({ length: 50 }, (_, slot) => `https://chatgpt.com/?voucher-test=ficticio-${slot + 1}`);
const emails = Array.from({ length: 50 }, (_, slot) => `guest${slot + 1}@example.test`);

test("imports Luma and link tables, preserving slots and rejecting over-allocation", () => {
  const header = '\uFEFFName,Email,"Question with a ; and a comma,"\r\n';
  const rows = emails.map((email, i) => `"Guest, ${i}",${email.toUpperCase()},"line one\r\nline two"`).join("\r\n");
  assert.deepEqual(parseVoucherGuests(header + rows), emails);
  assert.deepEqual(parseVoucherGuests("Nome;E-mail\nPessoa;owner@example.test"), ["owner@example.test"]);
  assert.deepEqual(parseVoucherLinks(links.join("\n")), links);
  assert.deepEqual(parseVoucherLinks("Position\tLink\n" + links.map((link, i) => `${i + 1}\t${link}`).join("\n")), links);
  assert.throws(() => parseVoucherGuests([...emails, "guest51@example.test"].join("\n")), /excede 50/);
  assert.throws(() => parseVoucherGuests("address@example.test\nADDRESS@example.test"), /repetidos/);
  assert.throws(() => parseVoucherLinks([...links.slice(1), links[1]].join("\n")), /repetidos/);
  assert.throws(() => parseVoucherLinks(["https://openai.com.example.test/voucher", ...links.slice(1)].join("\n")), /HTTPS/);
  assert.throws(() => parseVoucherLinks(links.slice(0, 49).join("\n")), /exatamente 50/);
});

test("voucher destinations are encrypted per slot and disclosed only by an authorized POST", async t => {
  const oldKey = process.env.WORKSHOP_VOUCHER_KEY;
  process.env.WORKSHOP_VOUCHER_KEY = "8c".repeat(32);
  t.after(() => {
    if (oldKey === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
    else process.env.WORKSHOP_VOUCHER_KEY = oldKey;
  });
  const { sealVoucher, unsealVoucher } = loadInput("lib/workshop-voucher/secrets.ts");
  const sealed = sealVoucher(links[0], 1);
  assert.ok(!sealed.includes("chatgpt.com"));
  assert.notEqual(sealVoucher(links[0], 1), sealed);
  assert.equal(unsealVoucher(sealed, 1), links[0]);
  assert.throws(() => unsealVoucher(sealed, 2));

  const origin = "https://apogee.example.test";
  let session = null;
  const load = opportunityLoader({
    "@/lib/members/mail": { applicationOrigin: () => origin },
    "@/lib/members/dal": { requireSignedInMember: async () => {
      if (!session) throw new Error("redirect to sign-in");
      return session;
    } },
    "@/lib/workshop-voucher/store": { openMemberVoucher: async id => id === "owner" ? links[0] : null },
  });
  const route = load("app/api/membros/workshop-voucher/abrir/route.ts");
  const open = source => route.POST(new Request(origin + "/api/membros/workshop-voucher/abrir", {
    method: "POST", headers: { origin: source },
  }));
  assert.equal(route.GET, undefined);
  assert.equal((await open("https://outside.example.test")).status, 403);
  await assert.rejects(open(origin), /sign-in/);
  session = { id: "outside" };
  assert.match((await open(origin)).headers.get("location"), /resultado=indisponivel/);
  session = { id: "owner" };
  const response = await open(origin);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), links[0]);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("one batch and one link per person, including concurrent claims and retryable notices", async t => {
  const db = await nativeCommunityDatabase();
  t.after(db.close);
  const options = { expectedRole: "apogee_local" };
  for (const migrate of [migrateCommunityAccess, migrateMemberToolbox, migrateMemberDeliverables, migrateMemberBenefits, migrateMonthlyDetails]) {
    await migrate(db.sql, { ...options, apply: true });
  }
  assert.deepEqual(await migrateWorkshopVouchers(db.sql, options), {
    migration: "0025_workshop_voucher", changed: false, pending: true,
  });
  const empty = { migration: "0025_workshop_voucher", pending: false, released: false, notice_started: false, stock: 0, assignments: 0 };
  assert.deepEqual(await migrateWorkshopVouchers(db.sql, { ...options, apply: true }), { ...empty, changed: true });
  assert.deepEqual(await migrateWorkshopVouchers(db.sql, { ...options, apply: true }), { ...empty, changed: false });
  const accounts = [
    ["admin", "admin@example.test", true, "admin"], ["same", emails[0], true, "member"],
    ["free", emails[1], false, "member"], ["other", "other@example.test", true, "member"],
    ["attempt", "attempt@example.test", true, "member"],
  ];
  for (const [id, email, verified, role] of accounts) {
    await db.sql`insert into "user"(id,name,email,email_verified,role) values(${id},${id},${email},${verified},${role})`;
  }
  const oldKey = process.env.WORKSHOP_VOUCHER_KEY;
  process.env.WORKSHOP_VOUCHER_KEY = "8c".repeat(32);
  t.after(() => {
    if (oldKey === undefined) delete process.env.WORKSHOP_VOUCHER_KEY;
    else process.env.WORKSHOP_VOUCHER_KEY = oldKey;
  });
  const sends = [];
  let simulateUncertainSend = true;
  let currentAccount = "same";
  const load = opportunityLoader({
    "@/lib/members/db": { getSql: () => db.sql },
    "@/lib/members/dal": { requireSignedInMember: async () => ({ id: currentAccount }) },
    "@/lib/members/mail": {
      applicationOrigin: () => "https://apogee.example.test",
      async sendMemberMailBatch(messages, key) {
        sends.push({ messages, key });
        if (simulateUncertainSend) throw Error("synthetic timeout");
      },
    },
  });
  const store = load("lib/workshop-voucher/store.ts");
  const route = load("app/api/membros/workshop-voucher/abrir/route.ts");
  const endpoint = "https://apogee.example.test/api/membros/workshop-voucher/abrir";
  const open = origin => route.POST(new Request(endpoint, { method: "POST", headers: { origin } }));

  const { batch: initial } = await store.adminVoucherStatus();
  await assert.rejects(store.saveVoucherStock("other", initial.revision, links), /administrativo/);
  await store.saveVoucherStock("admin", initial.revision, links);
  await assert.rejects(store.saveVoucherGuests("admin", initial.revision, emails), /lote mudou/i);
  let { batch } = await store.adminVoucherStatus();
  await store.saveVoucherGuests("admin", batch.revision, emails);
  assert.equal(await store.openMemberVoucher("same"), null);
  ({ batch } = await store.adminVoucherStatus());
  await store.releaseVoucherBatch("admin", batch.revision);
  await assert.rejects(store.saveVoucherGuests("admin", batch.revision, emails.slice(1)), /lote mudou/i);

  await assert.rejects(store.sendVoucherNotices("admin"), /synthetic timeout/);
  simulateUncertainSend = false;
  await store.sendVoucherNotices("admin");
  await store.sendVoucherNotices("admin");
  assert.equal(sends.length, 2);
  assert.deepEqual(sends[0], sends[1]);
  assert.deepEqual(sends[1].messages.map(message => message.to), emails);
  for (const message of sends[1].messages) {
    assert.ok(message.text.includes("https://apogee.example.test" + VOUCHER_PATH));
    assert.ok(!message.text.includes("https://chatgpt.com"));
  }

  const codeFor = index => sends[1].messages[index].text.match(/\b(?:[a-f0-9]{6}-){3}[a-f0-9]{6}\b/)[0];
  assert.equal((await open("https://elsewhere.example.test")).status, 403);
  assert.equal(await store.openMemberVoucher("free"), null);
  assert.equal(await store.openMemberVoucher("other"), null);
  assert.deepEqual(await Promise.all([store.openMemberVoucher("same"), store.openMemberVoucher("same")]), [links[0], links[0]]);
  const redirect = await open("https://apogee.example.test");
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("location"), links[0]);
  assert.equal(redirect.headers.get("referrer-policy"), "no-referrer");
  assert.match(redirect.headers.get("cache-control"), /no-store/);

  const race = await Promise.all([store.linkVoucherCode("free", codeFor(1)), store.linkVoucherCode("other", codeFor(1))]);
  assert.equal(race.filter(Boolean).length, 1);
  const owner = race[0] ? "free" : "other";
  const loser = race[0] ? "other" : "free";
  assert.equal(await store.openMemberVoucher(owner), links[1]);
  assert.equal(await store.openMemberVoucher(loser), null);
  assert.equal(await store.linkVoucherCode(owner, codeFor(2)), false);
  assert.equal(await store.linkVoucherCode("attempt", codeFor(49)), true);
  assert.equal(await store.openMemberVoucher("attempt"), links[49]);
  currentAccount = "other";
  await db.sql`update "user" set blocked=true where id='other'`;
  assert.match((await open("https://apogee.example.test")).headers.get("location"), /resultado=indisponivel/);
  await db.sql`delete from "user" where id=${owner}`;
  assert.equal(await store.linkVoucherCode(loser, codeFor(1)), false);
  const stock = await db.sql`select url_encrypted from workshop_voucher_stock`;
  assert.equal(stock.length, 50);
  assert.ok(stock.every(row => !row.url_encrypted.includes("chatgpt.com")));
});
