import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import Stripe from "stripe";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
import { migrateRadarBilling } from "../scripts/radar-billing-migrate.mjs";

const url = process.env.RADAR_BILLING_TEST_DATABASE_URL;
const ciDatabase = "postgres://billing_test:synthetic_ci_only@127.0.0.1:5432/apogee_billing_ci";
if (url !== "postgres://apogee_test@127.0.0.1:55441/postgres" && !(process.env.CI === "true" && url === ciDatabase)) throw new Error("Execute pelo runner com cluster novo e descartável.");
const sql = postgres(url, { ssl: false, max: 8, onnotice: () => {} });
const origin = "http://localhost:35441";
Object.assign(process.env, {
  APPLICATION_HOSTING_PROVIDER: "caddy", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "radar-billing-isolated-test-secret-at-least-32-chars",
  RADAR_BILLING_ENABLED: "true", STRIPE_MODE: "test", STRIPE_SECRET_KEY: "sk_test_synthetic",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic", STRIPE_RADAR_PRICE_ID: "price_radar", STRIPE_RADAR_PRODUCT_ID: "prod_radar",
  MEMBERS_EMAIL_ENABLED: "true", MEMBERS_RESEND_DOMAIN_VERIFIED: "true",
  MEMBERS_RESEND_API_KEY: "re_isolated_test_key_no_network", MEMBERS_RESEND_FROM: "contato@apogee.community",
});
const mails = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (address, options) => {
  assert.equal(address, "https://api.resend.com/emails", "nenhuma rede externa neste teste");
  mails.push(JSON.parse(options.body));
  return Response.json({ id: `test-mail-${mails.length}` });
};
const sessions = new Map();
const intents = new Map();
const items = new Map();
const disputes = new Map();
const requests = [];
let failProvider = false;
let createCount = 0;
let holdIntentRead;
const stripe = new Stripe("sk_test_synthetic", { maxNetworkRetries: 0,
  httpClient: Stripe.createFetchHttpClient(async (address, options) => {
    const parsed = new URL(address);
    assert.equal(parsed.hostname, "api.stripe.com");
    requests.push({ path: parsed.pathname, method: options.method, body: options.body });
    if (failProvider) return Response.json({ error: { type: "api_error", message: "synthetic private provider detail" } }, { status: 503 });
    let body;
    const id = parsed.pathname.split("/").at(-1);
    if (parsed.pathname === "/v1/prices/price_radar") body = price();
    else if (parsed.pathname === "/v1/checkout/sessions" && options.method === "POST") {
      const params = new URLSearchParams(options.body);
      assert.equal(params.get("mode"), "payment");
      assert.equal(params.get("line_items[0][price]"), "price_radar");
      assert.equal(params.get("line_items[0][quantity]"), "1");
      assert.equal(params.get("adaptive_pricing[enabled]"), "false", "a compra permanece BRL 49,00");
      assert.equal(params.has("payment_method_types[0]"), false);
      assert.match(params.get("integration_identifier"), /^apogee_radar_[a-z]{8}$/);
      body = fixture(`created${++createCount}`, params.get("client_reference_id"), params.get("customer_email"));
      body.metadata.integration = params.get("metadata[integration]");
      body.metadata.radar_user_id = params.get("metadata[radar_user_id]");
      body.status = "open"; body.payment_status = "unpaid";
      body.url = `https://checkout.stripe.com/c/pay/${body.id}`;
    } else if (parsed.pathname === "/v1/checkout/sessions") body = { object: "list", has_more: false,
      data: [...sessions.values()].filter(session => session.payment_intent === parsed.searchParams.get("payment_intent")) };
    else if (parsed.pathname.endsWith("/line_items")) body = { object: "list", has_more: false, data: items.get(parsed.pathname.split("/").at(-2)) };
    else if (parsed.pathname.startsWith("/v1/checkout/sessions/")) body = sessions.get(id);
    else if (parsed.pathname.startsWith("/v1/payment_intents/")) body = intents.get(id);
    else if (parsed.pathname === "/v1/disputes") body = { object: "list", has_more: false, data: disputes.get(parsed.searchParams.get("payment_intent")) ?? [] };
    else throw new Error(`Rota Stripe inesperada: ${parsed.pathname}`);
    assert.ok(body, `fixture disponível para ${parsed.pathname}`);
    const snapshot = structuredClone(body);
    if (parsed.pathname.startsWith("/v1/payment_intents/") && holdIntentRead) {
      const hold = holdIntentRead;
      holdIntentRead = null;
      hold.entered();
      await hold.wait;
    }
    return Response.json(snapshot);
  }),
});
function price() { return { id: "price_radar", object: "price", active: true, type: "one_time", product: "prod_radar", currency: "brl", unit_amount: 4900, livemode: false }; }
function fixture(name, userId = null, email = "buyer@example.test", paymentLink = false) {
  const session = { object: "checkout.session", id: `cs_test_${name}`, mode: "payment", status: "complete", payment_status: "paid",
    amount_total: 4900, currency: "brl", livemode: false, payment_intent: `pi_${name}`,
    customer_details: { email }, payment_link: paymentLink ? "plink_radar" : null,
    client_reference_id: userId, metadata: userId ? { integration: "apogee_radar_lifetime_v1", radar_user_id: userId } : {} };
  sessions.set(session.id, session);
  intents.set(session.payment_intent, { id: session.payment_intent, object: "payment_intent", status: "succeeded", livemode: false,
    amount: 4900, amount_received: 4900, currency: "brl", latest_charge: { id: `ch_${name}`, paid: true, captured: true, amount_refunded: 0, disputed: false } });
  items.set(session.id, [{ id: `li_${name}`, quantity: 1, amount_subtotal: 4900, amount_total: 4900, price: price() }]);
  return session;
}
let db;
const load = opportunityLoader({
  "./db": { getDb: () => db, getSql: () => sql },
  "@/lib/members/db": { getDb: () => db, getSql: () => sql },
  "./stripe": { stripeClient: () => stripe }, "@/lib/billing/stripe": { stripeClient: () => stripe },
  "next/headers": { headers: async () => new Headers() },
  "next/navigation": { redirect: destination => { throw new Error(`REDIRECT:${destination}`); } },
  "better-auth/next-js": { nextCookies: () => ({ id: "test-no-next-cookies" }) },
});
db = drizzle(sql, { schema: load("lib/members/schema.ts") });
const webhook = load("app/api/stripe/webhook/route.ts");
const checkout = load("app/api/radar/checkout/route.ts");
const verification = load("app/api/radar/verify-email/route.ts");
const { radarAccess } = load("lib/billing/store.ts");
const { requireRadarAccess } = load("lib/billing/access.ts");
let auth;
let eventCounter = 0;
const headers = cookie => ({ Origin: origin, "Content-Type": "application/json", "x-apogee-client-ip": "127.0.0.1", ...(cookie ? { cookie } : {}) });
async function signup(email, username) {
  const response = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, { method: "POST", headers: headers(),
    body: JSON.stringify({ email, username, name: "Pessoa Teste", password: "Synthetic-password-123!", role: "admin", emailVerified: true }) }));
  assert.equal(response.status, 200, await response.clone().text());
  const { user } = await response.json();
  return { id: user.id, email, cookie: response.headers.get("set-cookie").split(";")[0] };
}
function event(session, type = "checkout.session.completed") {
  return { id: `evt_synthetic_${++eventCounter}`, object: "event", type, livemode: false, created: Math.floor(Date.now() / 1000),
    data: { object: type.startsWith("checkout.") ? { id: session.id } : { payment_intent: session.payment_intent } } };
}
async function deliver(input, signatureOverride) {
  const body = JSON.stringify(input);
  const signature = signatureOverride ?? stripe.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_synthetic" });
  return webhook.POST(new Request(`${origin}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": signature }, body }));
}
async function buy(member, body = {}) {
  return checkout.POST(new Request(`${origin}/api/radar/checkout`, { method: "POST", headers: headers(member?.cookie), body: JSON.stringify(body) }));
}

test("Radar: autenticação real, webhook assinado, PostgreSQL, concessão e proteção do acesso", async t => {
  try {
    assert.equal((await sql`select to_regclass('public."user"') as name`)[0].name, null, "runner exige banco vazio");
    const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
    await sql`create schema drizzle`;
    await sql`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
    for (const entry of journal.entries.slice(0, 5)) {
      const source = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8");
      await sql.unsafe(source);
      await sql`insert into drizzle.__drizzle_migrations (hash, created_at) values (${createHash("sha256").update(source).digest("hex")}, ${entry.when})`;
    }
    await sql`insert into "user" (id, name, username, email) values ('legacy', 'Membro anterior', 'legacy', 'legacy@example.test')`;
    assert.equal((await migrateRadarBilling(sql)).changed, true);
    auth = load("lib/members/auth.ts").getAuth();
    const buyer = await signup("buyer@example.test", "buyer");
    const other = await signup("other@example.test", "other");

    await t.test("migração preserva acessos anteriores e não concede novamente ao repetir", async () => {
      assert.deepEqual(await radarAccess("legacy", false), { active: true, source: "legacy" });
      assert.equal((await migrateRadarBilling(sql)).changed, false);
      assert.equal((await radarAccess(buyer.id, false)).active, false);
      assert.equal((await sql`select role from "user" where id = ${buyer.id}`)[0].role, "member");
    });
    await t.test("origem e sessão são obrigatórias; checkout não confia no destinatário do navegador", async () => {
      assert.equal((await buy()).status, 401);
      assert.equal((await checkout.POST(new Request(`${origin}/api/radar/checkout`, { method: "POST", headers: { ...headers(buyer.cookie), Origin: "https://evil.test" } }))).status, 403);
      const response = await buy(buyer, { userId: other.id, amount: 1, price: "price_wrong" });
      assert.equal(response.status, 303);
      assert.ok(response.headers.get("location").startsWith("https://checkout.stripe.com/"));
      const session = [...sessions.values()].at(-1);
      assert.equal(session.client_reference_id, buyer.id);
      assert.equal(session.metadata.radar_user_id, buyer.id);
      assert.equal((await radarAccess(buyer.id, false)).active, false);
      await assert.rejects(requireRadarAccess(buyer.id), /REDIRECT:\/membros\/radar\/acesso/);
    });
    await t.test("retorno do checkout e evento sem assinatura não concedem acesso", async () => {
      const session = fixture("unsigned", buyer.id);
      assert.equal((await deliver(event(session), "invalid-signature")).status, 400);
      assert.equal((await webhook.POST(new Request(`${origin}/api/stripe/webhook`, { method: "POST", body: "{}" }))).status, 400);
      assert.equal((await radarAccess(buyer.id, false)).active, false);
    });
    await t.test("pendente, assinatura antiga, ambiente, preço e total incorretos não liberam", async () => {
      const session = fixture("ineligible", buyer.id);
      session.payment_status = "unpaid";
      assert.equal((await deliver(event(session))).status, 200);
      session.payment_status = "paid";
      const stale = event(session);
      const staleSignature = stripe.webhooks.generateTestHeaderString({ payload: JSON.stringify(stale), secret: "whsec_synthetic", timestamp: Math.floor(Date.now() / 1000) - 1000 });
      assert.equal((await deliver(stale, staleSignature)).status, 400);
      const wrongMode = event(session); wrongMode.livemode = true;
      assert.equal((await deliver(wrongMode)).status, 200);
      session.amount_total = 1;
      assert.equal((await deliver(event(session))).status, 200);
      session.amount_total = 4900; items.get(session.id)[0].price.id = "price_wrong";
      assert.equal((await deliver(event(session))).status, 200);
      assert.equal((await radarAccess(buyer.id, false)).active, false);
    });
    await t.test("falha do provedor reverte recibo e permite nova tentativa", async () => {
      const input = event(fixture("retry", buyer.id));
      failProvider = true;
      const response = await deliver(input);
      assert.equal(response.status, 503);
      assert.equal((await response.text()).includes("private provider detail"), false);
      assert.equal((await sql`select event_id from radar_stripe_event where event_id = ${input.id}`).length, 0);
      failProvider = false;
      assert.equal((await deliver(input)).status, 200);
      assert.deepEqual(await radarAccess(buyer.id, false), { active: true, source: "stripe" });
      await requireRadarAccess(buyer.id);
      assert.equal((await radarAccess(other.id, false)).active, false);
      const before = createCount;
      assert.equal((await buy(buyer)).headers.get("location"), `${origin}/membros/oportunidades`);
      assert.equal(createCount, before);
    });
    await t.test("reentrega concorrente gera somente uma compra e um recibo", async () => {
      const session = fixture("duplicate", buyer.id);
      const input = event(session);
      const responses = await Promise.all([deliver(input), deliver(input), deliver(input)]);
      assert.ok(responses.every(response => response.status === 200));
      assert.equal((await sql`select * from radar_purchase where session_id = ${session.id}`).length, 1);
      assert.equal((await sql`select * from radar_stripe_event where event_id = ${input.id}`).length, 1);
    });
    await t.test("Payment Link ignora client_reference_id e exige e-mail verificado de quem reivindica", async () => {
      const owner = await signup("linkbuyer@example.test", "linkbuyer");
      const session = fixture("link", other.id, " LinkBuyer@example.test ", true);
      assert.equal((await deliver(event(session))).status, 200);
      assert.equal((await radarAccess(other.id, false)).active, false);
      assert.equal((await radarAccess(owner.id, false)).active, false);
      const response = await verification.POST(new Request(`${origin}/api/radar/verify-email`, { method: "POST", headers: headers(owner.cookie) }));
      assert.equal(response.status, 303);
      const target = mails.at(-1).text.match(/http:\/\/localhost:35441\/api\/auth\/verify-email\?\S+/)[0];
      assert.equal((await auth.handler(new Request(target, { headers: { cookie: owner.cookie } }))).status, 302);
      assert.deepEqual(await radarAccess(owner.id, false), { active: true, source: "stripe" });
      assert.equal((await radarAccess(owner.id, true)).active, false, "pagamento teste não libera ambiente live");
      assert.equal((await sql`select user_id from radar_purchase where session_id = ${session.id}`)[0].user_id, owner.id);
    });
    await t.test("pagamento assíncrono libera; reembolso e eventos atrasados não restauram o acesso", async () => {
      const owner = await signup("async@example.test", "asyncbuyer");
      const session = fixture("async", owner.id);
      session.payment_status = "unpaid";
      await deliver(event(session));
      assert.equal((await radarAccess(owner.id, false)).active, false);
      session.payment_status = "paid";
      assert.equal((await deliver(event(session, "checkout.session.async_payment_succeeded"))).status, 200);
      assert.equal((await radarAccess(owner.id, false)).active, true);
      intents.get(session.payment_intent).latest_charge.amount_refunded = 4900;
      assert.equal((await deliver(event(session, "charge.refunded"))).status, 200);
      assert.equal((await radarAccess(owner.id, false)).active, false);
      await deliver(event(session));
      assert.equal((await radarAccess(owner.id, false)).active, false);
      assert.equal((await sql`select status from radar_purchase where session_id = ${session.id}`)[0].status, "refunded");
    });
    await t.test("disputa suspende, vitória restaura e bloqueio de conta prevalece", async () => {
      const owner = await signup("dispute@example.test", "disputebuyer");
      const session = fixture("dispute", owner.id);
      await deliver(event(session));
      intents.get(session.payment_intent).latest_charge.disputed = true;
      disputes.set(session.payment_intent, [{ id: "dp_synthetic", status: "needs_response" }]);
      await deliver(event(session, "charge.dispute.created"));
      assert.equal((await radarAccess(owner.id, false)).active, false);
      disputes.set(session.payment_intent, [{ id: "dp_synthetic", status: "won" }]);
      await deliver(event(session, "charge.dispute.closed"));
      assert.equal((await radarAccess(owner.id, false)).active, true);
      await sql`update "user" set blocked = true where id = ${owner.id}`;
      assert.equal((await radarAccess(owner.id, false)).active, false);
      assert.equal((await buy(owner)).status, 401);
    });
    await t.test("reembolso parcial mantém o direito; reembolso concorrente prevalece sobre confirmação antiga", async () => {
      const owner = await signup("race@example.test", "racebuyer");
      const session = fixture("race", owner.id);
      await deliver(event(session));
      intents.get(session.payment_intent).latest_charge.amount_refunded = 1000;
      await deliver(event(session, "charge.refunded"));
      assert.equal((await radarAccess(owner.id, false)).active, true);
      let release;
      let entered;
      const ready = new Promise(resolve => { entered = resolve; });
      const wait = new Promise(resolve => { release = resolve; });
      holdIntentRead = { entered, wait };
      const staleConfirmation = deliver(event(session));
      await ready;
      intents.get(session.payment_intent).latest_charge.amount_refunded = 4900;
      const reversal = deliver(event(session, "charge.refunded"));
      release();
      const responses = await Promise.all([staleConfirmation, reversal]);
      assert.ok(responses.every(response => response.status === 200));
      assert.equal((await radarAccess(owner.id, false)).active, false);
    });
    await t.test("leitura do webhook tem prazo absoluto mesmo quando o remetente não termina o corpo", async () => {
      const { webhookBody } = load("lib/billing/http.ts");
      const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([123])); } });
      const request = new Request(`${origin}/api/stripe/webhook`, { method: "POST", body: stream, duplex: "half" });
      await assert.rejects(webhookBody(request, 262144, 15), error => error.status === 408);
    });
    await t.test("evento de outra conta, item adicional e corpo acima do limite são recusados", async () => {
      const session = fixture("extra", other.id);
      const input = event(session); input.account = "acct_other";
      await deliver(input);
      items.get(session.id).push(items.get(session.id)[0]);
      await deliver(event(session));
      assert.equal((await radarAccess(other.id, false)).active, false);
      assert.equal((await webhook.POST(new Request(`${origin}/api/stripe/webhook`, { method: "POST", headers: { "stripe-signature": "x" }, body: "x".repeat(262145) }))).status, 413);
    });
    await t.test("migração recusa histórico ou esquema divergente sem conceder novos direitos", async () => {
      await sql`update drizzle.__drizzle_migrations set hash = 'invalid' where id = 6`;
      await assert.rejects(migrateRadarBilling(sql), /Histórico divergente/);
      const source = await readFile(new URL("../drizzle/0005_radar_lifetime.sql", import.meta.url), "utf8");
      await sql`update drizzle.__drizzle_migrations set hash = ${createHash("sha256").update(source).digest("hex")} where id = 6`;
      await sql`alter table radar_purchase rename column price_id to corrupted_price_id`;
      await assert.rejects(migrateRadarBilling(sql), /Esquema divergente/);
      await sql`alter table radar_purchase rename column corrupted_price_id to price_id`;
      assert.equal((await migrateRadarBilling(sql)).changed, false);
      assert.equal((await sql`select * from radar_legacy_access`).length, 1);
    });
  } finally {
    globalThis.fetch = originalFetch;
    await sql.end();
  }
});
