// Run against a local build, using the project's shared npm queue.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { serializeSignedCookie } from "better-call";
import postgres from "postgres";

const { chromium } = await import(process.env.BEHAVIOR_PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
assert.ok(!readdirSync(root).some(name => /^\.env(?:$|\.(?:local|production)(?:\.|$))/.test(name)),
  "The fixture requires a copy without runtime .env files");

const origin = "http://127.0.0.1:4381";
const directory = mkdtempSync(path.join(tmpdir(), "apogee-amplitude-"));
const pgData = path.join(directory, "data");
const secret = randomBytes(32).toString("hex");
const memberId = "fixture-approved-member";
const otherId = "fixture-other-member";
const pendingId = "fixture-pending-member";
const apiKey = "fixture-amplitude-key";
const allowChoice = { choice: "allow", version: 2 };
const rows = [];
const checks = [];
let collectorStatus = 200;
let serverLog = "";
let pgStarted = false;
let sql, child, browser;

function command(name, args) {
  const result = spawnSync(name, args, { encoding: "utf8", env: { PATH: process.env.PATH, LC_ALL: "C" } });
  if (result.status !== 0) throw Error(`${name} failed: ${result.stderr || result.stdout || result.error}`);
}

async function listen(server, port = 0) {
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function waitFor(predicate, label, timeout = 12_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await predicate()) return;
    await pause(50);
  }
  throw Error(label);
}

const withdrawn = new Set();
const catalogueFixture = ["synthetic-event", "synthetic-race", "synthetic-unavailable", "synthetic-withdrawn"].map((id, index) => ({
  id, title: `Hackathon sintético ${index + 1}`, institution: "Instituição sintética",
  officialUrl: "https://example.invalid/private-landing?token=fixture-secret",
  benefitType: "other", applicantType: "undergraduate_student", categories: ["competicoes"],
  lastCheckedAt: new Date().toISOString(), opportunityStatus: "open", nationallyEligible: true,
  deadlineAt: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10), deadlinePrecision: "date_only",
}));
const fixtureServer = createServer(async (request, response) => {
  const url = new URL(request.url, origin);
  if (url.pathname === "/catalogue" && request.headers.authorization === "Bearer fixture-radar-token") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ version: 3, opportunities: catalogueFixture.filter(item => !withdrawn.has(item.id)) }));
    return;
  }
  if (request.method !== "POST" || url.pathname !== "/2/httpapi") {
    response.writeHead(404).end();
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    rows.push({ body, headers: request.headers, status: collectorStatus });
    response.writeHead(collectorStatus, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: collectorStatus, events_ingested: collectorStatus === 200 ? 1 : 0 }));
  } catch {
    response.writeHead(400).end();
  }
});

const count = event => rows.filter(row => row.body.events[0].event_type === event).length;
const waitCount = (event, expected) => waitFor(() => count(event) >= expected, `Missing ${event} at count ${expected}`);
const endpoint = origin + "/api/radar/amplitude";
const detail = id => origin + "/membros/oportunidades/radar-" + id;
const settings = page => page.locator("summary").filter({ hasText: /^Preferências de medição do Radar$/ });
const allow = page => page.getByRole("button", { name: "Permitir medição do Radar" });
const revoke = page => page.getByRole("button", { name: "Revogar permissão" });
const save = page => page.getByRole("button", { name: "Salvar no meu calendário", exact: true });
const saved = page => page.getByRole("button", { name: "Remover dos salvos", exact: true });

try {
  const appPortProbe = createServer();
  await listen(appPortProbe, 4381);
  await new Promise(resolve => appPortProbe.close(resolve));
  const fixturePort = await listen(fixtureServer);
  const portProbe = createServer();
  const databasePort = await listen(portProbe);
  await new Promise(resolve => portProbe.close(resolve));
  command("initdb", ["-D", pgData, "-A", "trust", "-U", "amplitude_preview", "--no-locale", "--encoding=UTF8"]);
  command("pg_ctl", ["-D", pgData, "-l", path.join(directory, "postgres.log"), "-o",
    `-k ${directory} -p ${databasePort} -c listen_addresses='127.0.0.1' -c max_connections=12 -c shared_buffers=16MB`, "-w", "start"]);
  pgStarted = true;

  const databaseUrl = `postgres://amplitude_preview@127.0.0.1:${databasePort}/postgres`;
  sql = postgres(databaseUrl, { ssl: false, max: 1, prepare: false, onnotice() {} });
  const [database] = await sql`select current_user as role, current_database() as db, inet_server_port() as port`;
  assert.deepEqual({ ...database }, { role: "amplitude_preview", db: "postgres", port: databasePort });
  const journal = JSON.parse(readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
  for (const { tag } of journal.entries) {
    await sql.unsafe(readFileSync(path.join(root, "drizzle", tag + ".sql"), "utf8"));
  }

  const tokens = new Map();
  for (const [index, id] of [memberId, otherId, pendingId].entries()) {
    const token = randomBytes(32).toString("hex");
    tokens.set(id, token);
    await sql`insert into "user" (id, name, email, email_verified, username, adult_declared)
      values (${id}, 'Pessoa Sintética', ${id + "@example.test"}, true, ${"fixture_" + index}, true)`;
    await sql`insert into "session" (id, token, user_id, expires_at)
      values (${id + "-session"}, ${token}, ${id}, now() + interval '1 hour')`;
    await sql`insert into radar_legacy_access (user_id) values (${id})`;
    if (id !== pendingId) {
      await sql`insert into member_adult_review (user_id, status, reviewed_at, evidence_reference)
        values (${id}, 'approved', now(), 'synthetic evidence')`;
    }
  }

  const fixtureOrigin = `http://127.0.0.1:${fixturePort}`;
  async function startWeb(enabled) {
    child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start",
      "--hostname", "127.0.0.1", "--port", "4381"], {
      cwd: root, stdio: ["ignore", "pipe", "pipe"],
      env: {
        PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=768",
        NEXT_TELEMETRY_DISABLED: "1", APOGEE_LOCAL_PREVIEW: "1", APPLICATION_HOSTING_PROVIDER: "caddy",
        BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, DATABASE_URL: databaseUrl, DATABASE_SSL_MODE: "disable",
        MEMBERS_EMAIL_ENABLED: "false", MEMBERS_SUPERVISED_REGISTRATION_ENABLED: "true",
        RADAR_CALENDAR_PERSONAL_ENABLED: "true", STRIPE_MODE: "test", RADAR_BILLING_ENABLED: "false",
        RADAR_ACADEMICO_API_URL: fixtureOrigin + "/catalogue", RADAR_ACADEMICO_API_TOKEN: "fixture-radar-token",
        APOGEE_RADAR_AMPLITUDE_ENABLED: enabled ? "true" : "false",
        APOGEE_RADAR_AMPLITUDE_API_KEY: apiKey, APOGEE_RADAR_AMPLITUDE_IDENTITY_SECRET: secret,
        APOGEE_RADAR_AMPLITUDE_TEST_ENDPOINT: fixtureOrigin + "/2/httpapi",
      },
    });
    child.stdout.on("data", data => { serverLog += data; });
    child.stderr.on("data", data => { serverLog += data; });
    await waitFor(async () => {
      if (child.exitCode !== null) throw Error("The fixture web server exited");
      return await fetch(origin).then(result => result.ok, () => false);
    }, "The fixture web server did not start");
  }

  async function stopWeb() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      await exited;
    }
  }

  async function contextFor(id, extraHTTPHeaders = {}) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, reducedMotion: "reduce",
      extraHTTPHeaders: { "x-apogee-client-ip": "127.0.0.1", ...extraHTTPHeaders },
    });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    if (id) {
      const signed = await serializeSignedCookie("better-auth.session_token", tokens.get(id), secret, { path: "/", httpOnly: true });
      await context.addCookies([{ name: "better-auth.session_token", value: signed.split(";")[0].slice("better-auth.session_token=".length), url: origin }]);
    }
    return context;
  }

  const post = (context, body, headers = {}) => context.request.post(endpoint, { data: body, headers: { origin, ...headers } });
  browser = await chromium.launch({ channel: "chrome", headless: true });
  await startWeb(false);
  const member = await contextFor(memberId);
  const page = await member.newPage();
  await page.goto(origin + "/membros/oportunidades");
  await page.getByRole("heading", { name: "Radar de oportunidades" }).waitFor();
  assert.equal(await settings(page).count(), 0);
  assert.equal((await post(member, allowChoice)).status(), 404);
  assert.equal(rows.length, 0);
  checks.push("flag desligada");
  await stopWeb();
  await startWeb(true);

  const anonymous = await contextFor();
  const publicPage = await anonymous.newPage();
  await publicPage.goto(origin + "/oportunidades");
  assert.equal(await settings(publicPage).count(), 0);
  assert.equal((await post(anonymous, allowChoice)).status(), 403);
  const pending = await contextFor(pendingId);
  const pendingPage = await pending.newPage();
  await pendingPage.goto(origin + "/membros/oportunidades");
  assert.equal(await settings(pendingPage).count(), 0);
  assert.equal((await post(pending, allowChoice)).status(), 403);
  await anonymous.close();
  await pending.close();
  checks.push("sessão válida e revisão de maioridade exigidas");

  await page.bringToFront();
  await page.goto(origin + "/membros/oportunidades?busca=Hackathon");
  await settings(page).press("Enter");
  await allow(page).waitFor();
  assert.equal(rows.length, 0);
  assert.equal((await post(member, { choice: "allow" })).status(), 400);
  await page.getByRole("button", { name: "Recusar medição do Radar" }).click();
  await page.getByText("Medição do Radar desativada.", { exact: true }).waitFor();
  assert.equal(rows.length, 0);
  await allow(page).click();
  await revoke(page).waitFor();
  await waitCount("radar_list_viewed", 1);
  checks.push("preferências acionáveis por teclado, recusa e consentimento explícito");

  const firstGrant = (await sql`select grant_id from radar_amplitude_consent where user_id=${memberId}`)[0].grant_id;
  const detailUrl = detail("synthetic-event");
  await member.request.get(detailUrl, { headers: { "next-router-prefetch": "1" } });
  assert.equal(count("radar_detail_viewed"), 0);
  await page.goto(detailUrl);
  await save(page).waitFor();
  await waitCount("radar_detail_viewed", 1);
  await save(page).click();
  await saved(page).waitFor();
  await waitCount("radar_opportunity_saved", 1);
  assert.equal((await sql`select count(*)::int as n from radar_saved_opportunity
    where user_id=${memberId} and opportunity_id='radar-synthetic-event' and removed_at is null`)[0].n, 1);
  const popup = page.waitForEvent("popup");
  await page.locator('a[data-behavior-action="official_link"]').first().click();
  await (await popup).close();
  await waitCount("radar_official_link_clicked", 1);
  assert.deepEqual(rows.slice(0, 4).map(row => row.body.events[0].event_type), [
    "radar_list_viewed", "radar_detail_viewed", "radar_opportunity_saved", "radar_official_link_clicked",
  ]);
  checks.push("quatro eventos na jornada real, prefetch sem evento, salvamento persistido");

  const other = await contextFor(otherId);
  assert.equal((await post(other, { event: "radar_list_viewed", grant: firstGrant })).status(), 403);
  assert.equal((await post(member, { event: "radar_opportunity_saved", grant: firstGrant })).status(), 400);
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant, email: "fixture@example.test" })).status(), 400);
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant }, { origin: "https://elsewhere.invalid" })).status(), 403);
  await other.close();
  checks.push("troca de conta, origem diferente, falsificação de salvamento e campos extras rejeitados");

  const race = await member.newPage();
  await Promise.all([page.goto(detail("synthetic-race")), race.goto(detail("synthetic-race"))]);
  await Promise.all([save(page).click(), save(race).click()]);
  await Promise.all([saved(page).waitFor(), saved(race).waitFor()]);
  await waitCount("radar_opportunity_saved", 2);
  await pause(400);
  assert.equal(count("radar_opportunity_saved"), 2);
  checks.push("salvamentos concorrentes geram um evento");

  await page.goto(origin + "/membros/meu-calendario/salvar/radar-synthetic-withdrawn");
  const saveCard = page.getByRole("button", { name: /^Salvar .* na minha agenda$/ });
  await saveCard.waitFor();
  withdrawn.add("synthetic-withdrawn");
  await saveCard.click();
  await page.getByText("Não foi possível salvar a alteração. Tente novamente.", { exact: true }).waitFor();
  assert.equal((await sql`select count(*)::int as n from radar_saved_opportunity
    where user_id=${memberId} and opportunity_id='radar-synthetic-withdrawn'`)[0].n, 0);
  assert.equal(count("radar_opportunity_saved"), 2);
  withdrawn.delete("synthetic-withdrawn");
  checks.push("falha de gravação não gera evento de salvamento");

  const privateBrowser = await contextFor(memberId, { "sec-gpc": "1", dnt: "1" });
  await privateBrowser.addInitScript(() => Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true }));
  const privatePage = await privateBrowser.newPage();
  await privatePage.goto(detail("synthetic-withdrawn"));
  assert.equal((await post(privateBrowser, { event: "radar_list_viewed", grant: firstGrant })).status(), 403);
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant }, { dnt: "1" })).status(), 403);
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant }, { "sec-gpc": "1" })).status(), 403);
  await save(privatePage).click();
  await saved(privatePage).waitFor();
  assert.equal(count("radar_opportunity_saved"), 2);
  await privateBrowser.close();
  checks.push("GPC e Do Not Track respeitados");

  collectorStatus = 503;
  await page.goto(detail("synthetic-unavailable"));
  await save(page).click();
  await saved(page).waitFor();
  await waitCount("radar_opportunity_saved", 3);
  assert.equal(rows.findLast(row => row.body.events[0].event_type === "radar_opportunity_saved").status, 503);
  collectorStatus = 200;
  checks.push("salvamento funciona durante falha do coletor");

  await settings(page).click();
  await revoke(page).click();
  await page.getByText("Medição do Radar desativada.", { exact: true }).waitFor();
  const afterRevocation = rows.length;
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant })).status(), 403);
  await race.locator('a[data-behavior-action="official_link"]').first().click();
  await page.goto(origin + "/membros/oportunidades");
  await pause(500);
  assert.equal(rows.length, afterRevocation);
  const renewed = await post(member, allowChoice);
  assert.equal(renewed.status(), 200);
  assert.notEqual((await renewed.json()).grant, firstGrant);
  assert.equal((await post(member, { event: "radar_list_viewed", grant: firstGrant })).status(), 403);
  checks.push("revogação entre abas e invalidação da permissão anterior");

  const insertIds = new Set();
  const analyticsIds = new Set();
  for (const { body, headers } of rows) {
    assert.deepEqual(Object.keys(body).sort(), ["api_key", "events"]);
    assert.equal(body.api_key, apiKey);
    assert.equal(body.events.length, 1);
    const [event] = body.events;
    assert.deepEqual(Object.keys(event).sort(), ["event_type", "insert_id", "time", "user_id"]);
    assert.match(event.user_id, /^[0-9a-f]{64}$/);
    assert.match(event.insert_id, /^[0-9a-f-]{36}$/);
    assert.ok(Number.isSafeInteger(event.time));
    assert.equal(headers.cookie, undefined);
    assert.equal(headers.referer, undefined);
    assert.equal(headers["x-apogee-client-ip"], undefined);
    assert.doesNotMatch(JSON.stringify(event), /fixture|example|Hackathon|@|https|busca/i);
    insertIds.add(event.insert_id);
    analyticsIds.add(event.user_id);
  }
  assert.equal(insertIds.size, rows.length);
  assert.equal(analyticsIds.size, 1);
  checks.push("payload mínimo e identificador pseudônimo estável");
  console.log(JSON.stringify({ checks, events: rows.map(row => row.body.events[0].event_type) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ checksCompleted: checks }));
  console.error(serverLog);
  throw error;
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  if (sql) await sql.end();
  if (pgStarted) command("pg_ctl", ["-D", pgData, "-m", "fast", "-w", "stop"]);
  if (fixtureServer.listening) await new Promise(resolve => fixtureServer.close(resolve));
}
