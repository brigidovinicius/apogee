// Real hosted Checkout test: sandbox only, a fresh PostgreSQL and loopback server.
// Complete the hosted form with a fictitious card; never use a real payment method.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:http";
import { createServer as portProbe } from "node:net";
import postgres from "postgres";
import Stripe from "stripe";

const expectedAccount = "acct_1R7iAjPOeMUj2lOm";
const productId = "prod_VTcxn4KK0u6RoN";
const priceId = "price_1USfhEPOeMUj2lOmJKEsaQNi";
const pgBin = process.env.PG_BIN;
assert.ok(pgBin, "Informe PG_BIN com os binários PostgreSQL existentes.");
const credentials = JSON.parse(execFileSync("python3", ["-c", [
  "import json,tomllib", "from pathlib import Path",
  "c=tomllib.loads((Path.home()/'.config/stripe/config.toml').read_text())['default']",
  "print(json.dumps({'account':c['account_id'],'key':c['test_mode_api_key']}))",
].join("\n")], { encoding: "utf8" }));
assert.equal(credentials.account, expectedAccount, "A CLI precisa estar na área restrita aprovada.");
assert.match(credentials.key, /^(sk|rk)_test_/);
const stripe = new Stripe(credentials.key, { maxNetworkRetries: 1, timeout: 10000 });
assert.equal((await stripe.accounts.retrieve()).id, expectedAccount);
const price = await stripe.prices.retrieve(priceId);
assert.equal(price.livemode, false); assert.equal(price.product, productId);
assert.equal(price.unit_amount, 4900); assert.equal(price.currency, "brl");
assert.equal(price.type, "one_time"); assert.equal(price.active, true);
const origin = "http://127.0.0.1:35441";
for (const port of [35441, 55441]) await new Promise((done, reject) => {
  const probe = portProbe(); probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(done));
});
const directory = await mkdtemp(join(tmpdir(), "apogee-stripe-real-e2e-"));
const data = join(directory, "data");
const databaseUrl = "postgres://apogee_test@127.0.0.1:55441/postgres";
const run = (command, args) => {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${command.split("/").at(-1)} falhou.`);
};
const pause = ms => new Promise(done => setTimeout(done, ms));
const redact = input => String(input).replace(/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, "[REDACTED]");
const report = { account: expectedAccount, mode: "test", productId, priceId, amount: 4900, currency: "brl", directory };
let pgStarted = false, database, listener, server, bridge;
let applicationLogs = "", listenerLogs = "", signingSecret;
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise(done => {
    if (child.exitCode !== null) return done();
    const timer = setTimeout(() => child.kill("SIGKILL"), 8000);
    child.once("exit", () => { clearTimeout(timer); done(); });
  });
}
try {
  run(join(pgBin, "initdb"), ["-D", data, "-U", "apogee_test", "-A", "trust", "--no-locale", "-E", "UTF8"]);
  run(join(pgBin, "pg_ctl"), ["-D", data, "-l", join(directory, "postgres.log"), "-o", `-h 127.0.0.1 -p 55441 -k ${directory}`, "-w", "start"]);
  pgStarted = true;
  database = postgres(databaseUrl, { ssl: false, max: 3, onnotice: () => {} });
  await database`create schema drizzle`;
  await database`create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)`;
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) {
    const source = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    await database.unsafe(source);
    await database`insert into drizzle.__drizzle_migrations (hash, created_at) values (${createHash("sha256").update(source).digest("hex")}, ${entry.when})`;
  }
  const sample = { id: "sandbox-lifetime", title: "TESTE SANDBOX Radar vitalício", institution: "Instituição sintética",
    officialUrl: "https://example.com/sandbox", lastCheckedAt: new Date().toISOString(), applicantType: "mixed",
    benefitType: "other", categories: ["eventos"], deadlineAt: "2099-12-31", deadlinePrecision: "date_only",
    opportunityStatus: "open", requirementsText: "Oportunidade sintética para validar o acesso.", amountText: "Evento sintético.", stateCode: "SC", cityName: "Florianópolis" };
  const second = { ...sample, id: "sandbox-second", title: "TESTE SANDBOX Segunda oportunidade" };
  bridge = createServer((request, response) => {
    if (request.headers.authorization !== "Bearer sandbox-radar-bridge-only") { response.writeHead(401).end(); return; }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ version: 3, opportunities: [sample, second] }));
  });
  await new Promise(done => bridge.listen(0, "127.0.0.1", done));
  listener = spawn("stripe", ["listen", "--color", "off", "--skip-update", "--latest", "--events",
    "checkout.session.completed,checkout.session.async_payment_succeeded,charge.refunded,charge.dispute.created,charge.dispute.closed",
    "--forward-to", `${origin}/api/stripe/webhook`], { env: { ...process.env, STRIPE_API_KEY: credentials.key }, stdio: ["ignore", "pipe", "pipe"] });
  const captureListener = chunk => {
    const line = chunk.toString();
    signingSecret ??= line.match(/whsec_[A-Za-z0-9]+/)?.[0];
    listenerLogs = (listenerLogs + redact(line)).slice(-12000);
    if (/\[200\].*POST/.test(line)) console.log(redact(line.trim()));
  };
  listener.stdout.on("data", captureListener); listener.stderr.on("data", captureListener);
  const listenerDeadline = Date.now() + 45000;
  while (!signingSecret && Date.now() < listenerDeadline && listener.exitCode === null) await pause(250);
  assert.ok(signingSecret, "Listener Stripe não ficou pronto.");
  server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "35441"], {
    env: { PATH: process.env.PATH, NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=3072",
      BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"), DATABASE_URL: databaseUrl,
      DATABASE_SSL_MODE: "disable", DATABASE_POOL_MAX: "3", RADAR_BILLING_ENABLED: "true", STRIPE_MODE: "test",
      MEMBERS_SUPERVISED_REGISTRATION_ENABLED: "true",
      RADAR_CALENDAR_PERSONAL_ENABLED: "true",
      STRIPE_SECRET_KEY: credentials.key, STRIPE_WEBHOOK_SECRET: signingSecret, STRIPE_RADAR_PRICE_ID: priceId, STRIPE_RADAR_PRODUCT_ID: productId,
      RADAR_ACADEMICO_API_URL: `http://127.0.0.1:${bridge.address().port}/api/public/opportunities`, RADAR_ACADEMICO_API_TOKEN: "sandbox-radar-bridge-only",
      MEMBERS_EMAIL_ENABLED: "false", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const captureApplication = chunk => { applicationLogs = (applicationLogs + redact(chunk)).slice(-12000); };
  server.stdout.on("data", captureApplication); server.stderr.on("data", captureApplication);
  const get = (path, cookie = "") => fetch(origin + path, { headers: cookie ? { Cookie: cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(60000) });
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try { const response = await get("/api/stripe/webhook"); if (response.status === 405) { ready = true; break; } } catch {}
    if (server.exitCode !== null) break;
    await pause(500);
  }
  assert.ok(ready, "Servidor local não ficou pronto.");
  const publicHtml = await (await get("/oportunidades")).text();
  assert.match(publicHtml, /TESTE SANDBOX Radar vitalício/);
  assert.doesNotMatch(publicHtml, /Oportunidade sintética para validar o acesso\.|https:\/\/example\.com\/sandbox/);
  const firstPath = `/membros/oportunidades/radar-${sample.id}`;
  const secondPath = `/membros/oportunidades/radar-${second.id}`;
  const assertRedirect = async (response, destination) => {
    const html = await response.text();
    assert.ok(response.headers.get("location")?.includes(destination) || html.includes("NEXT_REDIRECT") && html.includes(destination), `redirect to ${destination}`);
    return html;
  };
  await assertRedirect(await get(firstPath), "/membros/entrar");
  const username = `radar${Date.now()}`;
  const email = `${username}@example.com`;
  const password = "Sandbox-only-Radar-49-2026!";
  const signUp = await fetch(`${origin}/api/auth/sign-up/email`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ adultDeclared: true, name: "Teste Radar Sandbox", username, email, password }) });
  assert.equal(signUp.status, 200, "Cadastro sintético com Better Auth real.");
  const user = (await signUp.json()).user;
  const cookie = signUp.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  const before = await get("/membros/oportunidades", cookie);
  const denied = await before.text();
  assert.equal(before.status, 200);
  assert.match(denied, /TESTE SANDBOX Radar vitalício/);
  assert.doesNotMatch(denied, /Oportunidade sintética para validar o acesso\./);
  assert.doesNotMatch(denied, /https:\/\/example\.com\/sandbox/);
  assert.equal(user.emailVerified, false);
  await assertRedirect(await get("/membros", cookie), "/membros/protecao");
  const firstHtml = await (await get(firstPath, cookie)).text();
  assert.match(firstHtml, /Sua primeira oportunidade é grátis/);
  assert.doesNotMatch(firstHtml, /Oportunidade sintética para validar o acesso\./);
  const markup = [...firstHtml.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map(match=>match[0]).find(form=>form.includes("Abrir esta oportunidade grátis"));
  assert.ok(markup);
  const decode = value => value.replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  const freeForm = new FormData();
  for (const input of markup.matchAll(/<input\b[^>]*>/g)) {
    const name=input[0].match(/name="([^"]*)"/)?.[1];
    if(name)freeForm.append(decode(name),decode(input[0].match(/value="([^"]*)"/)?.[1]??''));
  }
  const free=await fetch(origin+firstPath,{method:"POST",headers:{Origin:origin,Cookie:cookie},body:freeForm,redirect:"manual"});
  assert.equal(free.status,303);
  assert.match(await (await get(firstPath,cookie)).text(),/Oportunidade sintética para validar o acesso\./);
  assert.match(await (await get(firstPath,cookie)).text(),/Esta é sua oportunidade gratuita/);
  const secondBefore=await assertRedirect(await get(secondPath,cookie),"/membros/radar/acesso");
  assert.doesNotMatch(secondBefore,/Oportunidade sintética para validar o acesso\./);
  const returnQuery=`next=${encodeURIComponent(secondPath)}`;
  assert.match(await (await get(`/membros/radar/acesso?payment=cancelled&${returnQuery}`,cookie)).text(),/O checkout foi encerrado/);
  assert.equal((await database`select count(*)::int as total from radar_purchase`)[0].total,0);
  const checkout = await fetch(`${origin}/api/radar/checkout?${returnQuery}`, { method: "POST", headers: { Origin: origin, Cookie: cookie }, redirect: "manual" });
  assert.equal(checkout.status, 303, "Aplicação criou Checkout Session no sandbox.");
  const checkoutUrl = checkout.headers.get("location");
  assert.equal(new URL(checkoutUrl).origin, "https://checkout.stripe.com");
  const sessionId = checkoutUrl.match(/cs_test_[A-Za-z0-9]+/)?.[0];
  assert.ok(sessionId);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  assert.equal(session.livemode, false); assert.equal(session.client_reference_id, user.id);
  assert.equal(session.amount_total, 4900); assert.equal(session.currency, "brl");
  assert.equal(session.success_url,`${origin}/membros/radar/acesso?payment=received&${returnQuery}`);
  assert.equal(session.cancel_url,`${origin}/membros/radar/acesso?payment=cancelled&${returnQuery}`);
  assert.equal((await database`select count(*)::int as total from member_adult_review where user_id=${user.id}`)[0].total,0);
  Object.assign(report,{publicCards:true,anonymousDetail:"login",firstDetail:"free",reopening:"free",secondDetail:"purchase",cancelledCheckout:"no_access",community:"review_required"});
  await writeFile(join(directory, "browser-fixture.json"), JSON.stringify({ origin, username, password, checkoutUrl }), { mode: 0o600 });
  console.log(JSON.stringify({ phase: "checkout_ready", checkoutUrl, origin, username, fixture: join(directory, "browser-fixture.json"), sessionId }));
  const paymentDeadline = Date.now() + 15 * 60 * 1000;
  let purchase;
  while (Date.now() < paymentDeadline) {
    [purchase] = await database`select * from radar_purchase where session_id = ${sessionId} and user_id = ${user.id} and status = 'paid'`;
    if (purchase) break;
    if (listener.exitCode !== null || server.exitCode !== null) throw new Error("Serviço de teste encerrou antes da confirmação.");
    await pause(1000);
  }
  assert.ok(purchase, "Pagamento de teste não foi confirmado dentro do prazo.");
  assert.equal(purchase.livemode, false);
  const after = await get(secondPath, cookie);
  assert.equal(after.status, 200);
  const html = await after.text();
  assert.match(html, /Oportunidade sintética para validar o acesso\./); assert.match(html, /TESTE SANDBOX Segunda oportunidade/);
  assert.doesNotMatch(html,/Salvar no meu calendário/);assert.match(html,/conclua a verificação da conta/);
  const accessPage = await (await get("/membros/radar/acesso", cookie)).text();
  assert.match(accessPage, /Seu acesso ao Radar está liberado/);
  assert.equal((await database`select role from "user" where id = ${user.id}`)[0].role, "member");
  const paidAgain=await fetch(`${origin}/api/radar/checkout?${returnQuery}`,{method:"POST",headers:{Origin:origin,Cookie:cookie},redirect:"manual"});
  assert.equal(paidAgain.status,303);assert.equal(paidAgain.headers.get("location"),origin+secondPath);
  await assertRedirect(await get("/membros",cookie),"/membros/protecao");
  const events = await stripe.events.list({ type: "checkout.session.completed", limit: 100 });
  const event = events.data.find(item => item.data.object.id === sessionId);
  assert.ok(event, "Evento real de checkout encontrado na Stripe.");
  for (let i = 0; i < 20 && !listenerLogs.includes(event.id); i++) await pause(250);
  assert.match(listenerLogs, new RegExp(`\\[200\\][^\\n]*${event.id}`), "Entrega real recebeu HTTP 200.");
  const payload = JSON.stringify(event);
  const replay = await fetch(`${origin}/api/stripe/webhook`, { method: "POST", headers: {
    "stripe-signature": stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }) }, body: payload });
  assert.equal(replay.status, 200);
  assert.equal((await database`select * from radar_purchase where session_id = ${sessionId}`).length, 1);
  assert.equal((await database`select * from radar_stripe_event where event_id = ${event.id}`).length, 1);
  Object.assign(report, { result: "passed", sessionId, eventId: event.id, paymentIntentId: purchase.payment_intent_id,
    webhookHttp: 200, radarBefore: "cards_only", radarAfter: 200, access: "lifetime", replayHttp: 200, purchaseCount: 1 });
  await writeFile(join(directory, "result.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ phase: "paid_verified", ...report }));
  // Janela curta para conferir a mesma tela autenticada no Safari.
  await pause(30000);
} catch (error) {
  report.result = "failed"; report.message = redact(error.message);
  await writeFile(join(directory, "result.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
  await writeFile(join(directory, "diagnostics.log"), redact(applicationLogs + "\n" + listenerLogs), { mode: 0o600 });
  console.error(JSON.stringify(report));
  process.exitCode = 1;
} finally {
  await stop(server); await stop(listener);
  if (bridge) await new Promise(done => bridge.close(done));
  if (database) await database.end();
  if (pgStarted) run(join(pgBin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Serviços próprios do teste encerrados; arquivos preservados em ${directory}`);
}
