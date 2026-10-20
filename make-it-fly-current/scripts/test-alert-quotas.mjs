// One disposable integration run: native PostgreSQL, compiled Next and fake Radar.
// Never reads operator DATABASE_URL, .env files, subscribers or mail credentials.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as portProbe } from "node:net";
import { join, resolve } from "node:path";
import postgres from "postgres";

const bin = process.env.MEMBERS_POSTGRES_BIN;
const ciUrl = process.env.ALERT_QUOTA_TEST_BOOTSTRAP_URL;
if (!bin && !ciUrl) throw new Error("Defina MEMBERS_POSTGRES_BIN; nenhum download é feito pelo teste.");
if (ciUrl && !(process.env.CI === "true" && ciUrl === "postgres://gallery_test:synthetic_ci_only@127.0.0.1:5432/apogee_gallery_ci")) {
  throw new Error("Bootstrap permitido somente no PostgreSQL sintético de CI.");
}
await access(resolve(".next/standalone/server.js"));
const root = await mkdtemp("/private/tmp/alerts-sec04-").catch(() => mkdtemp("/tmp/alerts-sec04-"));
const data = join(root, "data"), socket = join(root, "socket");
const database = "alerts_sec04_test", password = "synthetic-alert-quota-test-only";
const origin = "https://www.apogee.community";
const opportunityId = "123e4567-e89b-42d3-a456-426614174000";
const valid = (change = {}) => ({ action: "subscribe", opportunityId, email: "person@example.test", consent: true, ...change });
const pgRun = (name, args) => execFileSync(join(bin, name), args, { encoding: "utf8", stdio: "pipe" });
const freePort = async () => {
  const probe = portProbe(); await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve)); return port;
};
let sql, bridge, runningApp, startedDatabase = false;
const forwarded = [];
async function stopApp() {
  if (!runningApp) return;
  const child = runningApp; runningApp = null;
  if (child.exitCode !== null) return;
  const exit = once(child, "exit"); child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
  try { await exit; } finally { clearTimeout(timer); }
}
try {
  let databaseUrl;
  if (ciUrl) {
    const bootstrap = postgres(ciUrl, { ssl: false, max: 1 });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    const target = new URL(ciUrl); target.pathname = `/${database}`; databaseUrl = target.toString();
  } else {
    const port = await freePort(); await mkdir(socket);
    const pwFile = join(root, "password"); await writeFile(pwFile, `${password}\n`, { mode: 0o600 });
    pgRun("initdb", ["-D", data, "-U", "postgres", "--auth-host=scram-sha-256", "--auth-local=trust", `--pwfile=${pwFile}`, "--wal-segsize=1", "--no-locale", "--encoding=UTF8"]);
    pgRun("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${socket} -c shared_buffers=16MB -c max_connections=20 -c min_wal_size=2MB -c max_wal_size=8MB`, "-w", "start"]);
    startedDatabase = true;
    const bootstrap = postgres({ host: socket, port, user: "postgres", database: "postgres", ssl: false, max: 1 });
    try { await bootstrap.unsafe(`create database ${database}`); } finally { await bootstrap.end(); }
    databaseUrl = `postgres://postgres:${password}@127.0.0.1:${port}/${database}`;
  }
  sql = postgres(databaseUrl, { ssl: false, max: 1 });
  const migration = await readFile("drizzle/0000_init.sql", "utf8");
  const ddl = migration.match(/CREATE TABLE "rate_limit" \([\s\S]*?\n\);/);
  assert.ok(ddl, "use the tracked rate-limit table definition"); await sql.unsafe(ddl[0]);
  bridge = createServer(async (request, response) => {
    if (request.url !== "/api/internal/alerts" || request.headers.authorization !== "Bearer synthetic-alert-radar-token") {
      response.writeHead(404); response.end(); return;
    }
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString()); forwarded.push(payload);
    response.writeHead(200, { "Content-Type": "application/json" }); response.end('{"ok":true}');
  });
  await new Promise(resolve => bridge.listen(0, "127.0.0.1", resolve));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  async function startApp() {
    let logs = "";
    const child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
      cwd: resolve(".next/standalone"), env: {
        PATH: process.env.PATH, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1",
        DATABASE_URL: databaseUrl, DATABASE_SSL_MODE: "disable", DATABASE_POOL_MAX: "4",
        APPLICATION_HOSTING_PROVIDER: "caddy", BETTER_AUTH_URL: origin,
        BETTER_AUTH_SECRET: "synthetic-alert-quota-secret-at-least-32-characters",
        RADAR_ACADEMICO_API_URL: `http://127.0.0.1:${bridge.address().port}`, RADAR_ACADEMICO_API_TOKEN: "synthetic-alert-radar-token",
      }, stdio: ["ignore", "pipe", "pipe"],
    });
    runningApp = child;
    child.stdout.on("data", chunk => { logs = (logs + chunk).slice(-4000); });
    child.stderr.on("data", chunk => { logs = (logs + chunk).slice(-4000); });
    for (let i = 0; i < 60; i++) {
      if (child.exitCode !== null) throw new Error(`Standalone exited: ${logs}`);
      try { if ((await fetch(`${base}/api/members/invitations`, { signal: AbortSignal.timeout(1000) })).status === 401) return; }
      catch { /* wait only for the process owned by this integration */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error("Standalone did not become ready");
  }
  await startApp();
  const post = (body, ip = "198.51.100.10", other = {}) => fetch(`${base}/api/radar/alerts`, { method: "POST", signal: AbortSignal.timeout(12000),
    headers: { origin, "Content-Type": "application/json", "x-apogee-client-ip": ip, ...other }, body: JSON.stringify(body) });
  const clear = async () => { await sql`truncate rate_limit`; forwarded.length = 0; };
  const globalCount = async () => Number((await sql`select count from rate_limit where key='action:radar-alerts:subscribe'`)[0]?.count ?? 0);

  for (let i = 0; i < 100; i++) assert.equal((await post({ action: "subscribe" })).status, 400);
  assert.equal((await sql`select count(*)::int as total from rate_limit`)[0].total, 0);
  assert.equal(forwarded.length, 0); assert.equal((await post(valid())).status, 200);
  assert.equal(await globalCount(), 1);
  console.log("PASS: 100 malformed HTTP requests spend no persistent quota; the next valid subscription is forwarded");

  await clear();
  // Concurrency is inside this single integration task, against its own cluster.
  const replies = await Promise.all(Array.from({ length: 12 }, (_, i) => post(valid({ email: `person${i}@example.test` }))));
  assert.equal(replies.filter(r => r.status === 200).length, 10); assert.equal(replies.filter(r => r.status === 429).length, 2);
  assert.equal(forwarded.length, 10); assert.equal(await globalCount(), 10);
  await stopApp(); await startApp();
  assert.equal((await post(valid({ email: "after-restart@example.test" }), "198.51.100.10", { "x-forwarded-for": "203.0.113.1", "x-vercel-forwarded-for": "203.0.113.2" })).status, 429);
  assert.equal(await globalCount(), 10);
  assert.equal((await post(valid({ email: "independent@example.test" }), "198.51.100.11")).status, 200);
  console.log("PASS: concurrent same-IP requests admit only 10; restart and forged provider headers cannot reset the limit");

  await clear();
  const recipients = await Promise.all(Array.from({ length: 8 }, (_, i) => post(valid({ email: i % 2 ? " PERSON@EXAMPLE.TEST " : "person@example.test" }), `198.51.100.${i + 1}`)));
  for (const response of recipients) { assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true }); }
  assert.equal(forwarded.length, 3); assert.equal(await globalCount(), 3);
  const keys = await sql`select key from rate_limit`;
  assert.ok(keys.every(row => !row.key.includes("person@example.test") && !row.key.includes("198.51.100.")));
  assert.equal(keys.filter(row => row.key.startsWith("action:radar-alerts:subscribe-recipient:")).length, 1);
  console.log("PASS: concurrent normalized recipient aliases admit only 3 upstream requests, with identical public acknowledgements and pseudonymous keys");

  await clear();
  for (let i = 0; i < 10; i++) assert.equal((await post(valid({ email: `expiry${i}@example.test` }))).status, 200);
  assert.equal((await post(valid({ email: "expired-budget@example.test" }))).status, 429);
  await sql`update rate_limit set last_request=${Date.now() - 3_601_000} where key like 'action:radar-alerts:subscribe-ip:%'`;
  assert.equal((await post(valid({ email: "fresh-window@example.test" }))).status, 200);
  console.log("PASS: expired persistent client windows permit a new legitimate request");

  await clear();
  for (let i = 0; i < 100; i++) assert.equal((await post(valid({ email: `distributed${i}@example.test` }), `198.51.100.${i + 1}`)).status, 200);
  assert.equal((await post(valid({ email: "global-excess@example.test" }), "198.51.100.201")).status, 429);
  assert.equal(forwarded.length, 100);
  for (const action of ["confirm", "unsubscribe"]) assert.equal((await post({ action, token: "a".repeat(64) }, "invalid")).status, 200);
  assert.deepEqual(forwarded.slice(-2).map(item => item.action), ["confirm", "unsubscribe"]);
  console.log("PASS: the retained global ceiling stops forwarding after 100; confirmation and cancellation still work");
} finally {
  await stopApp();
  if (bridge) { bridge.closeAllConnections(); await new Promise(resolve => bridge.close(resolve)); }
  if (sql) await sql.end();
  if (startedDatabase) pgRun("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Synthetic evidence retained: ${root}`);
}
