// Local-only authenticated preview. No .env, production DB, real account or mail.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { serializeSignedCookie } from "better-call";
import postgres from "postgres";

const { chromium } = await import(process.env.BEHAVIOR_PLAYWRIGHT_MODULE || "playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(path.join(tmpdir(), "apogee-insights-preview-"));
const pgData = path.join(directory, "data");
const output = path.join(root, "outputs/behavior-validation");
mkdirSync(output, { recursive: true });
const secret = randomBytes(32).toString("hex");
const token = randomBytes(32).toString("hex");
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", env: { PATH: process.env.PATH, LC_ALL: "C" } });
  if (result.status !== 0) throw Error(`${command} failed: ${result.stderr || result.stdout}`);
}
async function freePort() {
  const server = createServer(); server.listen(0, "127.0.0.1"); await once(server, "listening");
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
}
const databasePort = await freePort(), webPort = await freePort();
const origin = `http://127.0.0.1:${webPort}`;
let pgStarted = false, sql, child, browser;
let serverLog = "";
const checks = [];
try {
  run("initdb", ["-D", pgData, "-A", "trust", "-U", "insights_preview", "--no-locale", "--encoding=UTF8"]);
  run("pg_ctl", ["-D", pgData, "-l", path.join(directory, "postgres.log"), "-o", `-k ${directory} -p ${databasePort} -c listen_addresses='127.0.0.1' -c max_connections=12 -c shared_buffers=16MB`, "-w", "start"]);
  pgStarted = true;
  const databaseUrl = `postgres://insights_preview@127.0.0.1:${databasePort}/postgres`;
  sql = postgres(databaseUrl, { ssl: false, max: 1, prepare: false, onnotice() {} });
  const [identity] = await sql`select current_user as role, current_database() as db, inet_server_port() as port`;
  assert.deepEqual({ ...identity }, { role: "insights_preview", db: "postgres", port: databasePort });
  const journal = JSON.parse(readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"));
  for (const entry of journal.entries) await sql.unsafe(readFileSync(path.join(root, `drizzle/${entry.tag}.sql`), "utf8"));
  await sql.unsafe(readFileSync(path.join(root, "sql/behavior-daily.sql"), "utf8"));
  await sql`insert into "user" (id,name,email,email_verified,username,role,adult_declared) values ('insights-preview-admin','Synthetic Preview','preview@example.test',true,'insights_preview','admin',true)`;
  await sql`insert into "session" (id,token,user_id,expires_at) values ('insights-preview-session',${token},'insights-preview-admin',now()+interval '1 hour')`;
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count)
    select (now() at time zone 'America/Sao_Paulo')::date - offset_day,'home',event,target,'desktop',value
    from generate_series(0,29) as offset_day cross join lateral (values
      ('page_view','view',60-offset_day), ('navigation','radar_list',1+offset_day%7),
      ('action','store_interest',1+offset_day%5), ('filter_apply','applied',1+offset_day%3)) as sample(event,target,value)
    where event in ('page_view','navigation')`;
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count)
    select (now() at time zone 'America/Sao_Paulo')::date - offset_day,'store','action','store_interest','desktop',1+offset_day%5 from generate_series(0,29) as offset_day`;
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count)
    select (now() at time zone 'America/Sao_Paulo')::date - offset_day,'radar_list','filter_apply','applied','mobile',1+offset_day%3 from generate_series(0,29) as offset_day`;
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count) values ((now() at time zone 'America/Sao_Paulo')::date-45,'home','page_view','view','desktop',1)`;
  child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"], env: {
      PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=768", NEXT_TELEMETRY_DISABLED: "1",
      APOGEE_LOCAL_PREVIEW: "1", APOGEE_BEHAVIOR_ENABLED: "true", BETTER_AUTH_URL: "http://127.0.0.1:4381", BETTER_AUTH_SECRET: secret,
      DATABASE_URL: databaseUrl, DATABASE_SSL_MODE: "disable", APPLICATION_HOSTING_PROVIDER: "caddy", MEMBERS_EMAIL_ENABLED: "false", RADAR_BILLING_ENABLED: "false",
    },
  });
  child.stdout.on("data", data => { serverLog += data; }); child.stderr.on("data", data => { serverLog += data; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw Error(`Local preview exited: ${serverLog}`);
    try { if ((await fetch(origin)).ok) break; } catch { /* Our own server is starting. */ }
    if (attempt === 149) throw Error("Preview startup timed out");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", extraHTTPHeaders: { "x-apogee-client-ip": "127.0.0.1" } });
  let posts = 0;
  await context.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) return route.abort();
    // Follow only deliberate navigation; background link prefetches are outside this test.
    if (request.headers()["next-router-prefetch"] || request.headers().purpose === "prefetch") return route.abort();
    if (request.method() === "POST") { posts++; return route.abort(); }
    return route.continue();
  });
  const signedCookie = await serializeSignedCookie("better-auth.session_token", token, secret, { path: "/", httpOnly: true, secure: false });
  await context.addCookies([{ name: "better-auth.session_token", value: signedCookie.split(";")[0].slice("better-auth.session_token=".length), url: origin }]);
  const page = await context.newPage();
  await page.goto(origin + "/admin/comportamento", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Evolução diária", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Semana contra semana", exact: true }).waitFor();
  for (const label of ["Visualizações", "Navegações", "Ações iniciadas", "Uso dos filtros"]) {
    const button = page.getByRole("button", { name: label, exact: true }); await button.click(); assert.equal(await button.getAttribute("aria-pressed"), "true");
  }
  const slider = page.getByLabel("Explorar dia", { exact: true });
  await slider.press("Home"); assert.equal(await slider.inputValue(), "0");
  await slider.press("ArrowRight"); assert.equal(await slider.inputValue(), "1");
  await page.getByText("Ver valores por dia", { exact: true }).click();
  assert.equal(await page.getByRole("table", { name: /por dia$/ }).getByRole("row").count(), 31);
  await page.getByText("Ver valores por dia", { exact: true }).click();
  await page.getByRole("button", { name: "Visualizações", exact: true }).click();
  await slider.press("End");
  await page.getByRole("region", { name: "Evolução diária", exact: true }).screenshot({ path: path.join(output, "insights-daily-desktop.png") });
  await page.getByRole("region", { name: "Semana contra semana", exact: true }).screenshot({ path: path.join(output, "insights-weeks-desktop.png") });
  checks.push("authenticated admin, four metrics, keyboard day exploration, accessible daily table and closed weeks");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("region", { name: "Evolução diária", exact: true }).screenshot({ path: path.join(output, `insights-daily-mobile-${width}.png`) });
    const overflow = await page.evaluate(() => ({
      width: window.innerWidth, scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 15).map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right })),
    }));
    assert.ok(overflow.scroll <= overflow.width, JSON.stringify(overflow));
  }
  checks.push("responsive 390px and 320px without page overflow; reduced motion");
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    assert.equal(await page.getByRole("button", { name: "Visualizações", exact: true }).isVisible(), true);
    assert.equal(await page.getByRole("region", { name: "Evolução diária", exact: true }).evaluate(element => getComputedStyle(element).backgroundColor), "rgb(16, 42, 72)");
  }
  checks.push("admin palette remains readable with light and dark system preferences");
  await sql`delete from apogee_behavior_daily`;
  await sql`insert into apogee_behavior_daily (day,page,event,target,device,count) values ((now() at time zone 'America/Sao_Paulo')::date,'home','page_view','view','desktop',4)`;
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByText("Histórico incompleto", { exact: true }).count(), 4);
  await page.getByRole("region", { name: "Semana contra semana", exact: true }).screenshot({ path: path.join(output, "insights-new-history-mobile.png") });
  checks.push("new history suppresses weekly percentages");
  await sql`delete from apogee_behavior_daily`;
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText(/Ainda não há registros de comportamento/).waitFor();
  checks.push("empty history stays empty instead of fabricated zero growth");
  await sql`update "user" set role='member' where id='insights-preview-admin'`;
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(page.url().includes("/admin/acesso-negado"));
  assert.equal(posts, 0); checks.push("member denied and no tracking or business POSTs from admin chart interactions");
  writeFileSync(path.join(output, "insights-browser.json"), JSON.stringify({ passed: true, data: "synthetic local only", checks }, null, 2));
  console.log(JSON.stringify({ passed: true, checks }));
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
  if (sql) await sql.end();
  if (pgStarted) run("pg_ctl", ["-D", pgData, "-m", "fast", "-w", "stop"]);
  writeFileSync(path.join(output, "insights-preview.log"), serverLog);
  console.log(`Isolated preview artifact: ${directory}`);
}
