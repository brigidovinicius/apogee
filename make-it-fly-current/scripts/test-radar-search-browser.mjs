// Run after a local build, through the global npm FIFO. Only synthetic loopback data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as tcpServer } from "node:net";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.RADAR_SEARCH_PLAYWRIGHT_MODULE || "playwright");
const output = new URL(process.argv[2] || "../outputs/radar-search-validation/", import.meta.url);
mkdirSync(output, { recursive: true });
const bind = async server => { server.listen(0, "127.0.0.1"); await once(server, "listening"); return server.address().port; };
const probe = tcpServer();
const port = await bind(probe);
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
let databaseConnections = 0;
const databaseTrap = tcpServer(socket => { databaseConnections++; socket.destroy(); });
const databasePort = await bind(databaseTrap);
const stamp = new Date().toISOString();
const raw = (id, patch = {}) => ({
  id, title: `Evento sintético de tecnologia ${id}`, institution: "Organização Sintética", benefitType: "unpaid_opportunity",
  applicantType: "mixed", categories: ["eventos"], isCourse: false, opportunityStatus: "open", verificationMethod: "automatic",
  lastCheckedAt: stamp, verifiedAt: stamp, deadlineAt: "2030-12-01T00:00:00Z", deadlinePrecision: "date_only", eventStartsAt: "2030-12-10",
  requirementsText: "Encontro para estudantes e profissionais.", amountText: "Inscrição gratuita.",
  cityName: "São Paulo", stateCode: "SP", officialUrl: `https://example.test/synthetic-${id}`, nationallyEligible: false,
  discovery: { areas: ["tecnologia"], editions: [] }, ...patch,
});
const records = [
  raw("redhat", { title: "Red Hat Summit: Connect 2030 São Paulo", institution: "Red Hat" }),
  ...Array.from({ length: 30 }, (_, index) => raw(String(index))),
  raw("mention", { title: "Oficina preparatória", requirementsText: "Preparação para Red Hat Summit Connect 2030 São Paulo.",
    discovery: { areas: ["artes"], editions: [] }, deadlineAt: "2029-12-01T00:00:00Z" }),
  raw("ai", { title: "Encontro Aurora", discovery: { areas: ["ia"], editions: [] } }),
  raw("art", { title: "Curso de fotografia", institution: "Museu", discovery: { areas: ["artes"], editions: [] } }),
  raw("closed", { title: "Congresso encerrado de IA", opportunityStatus: "closed", deadlineAt: "2026-01-01T00:00:00Z",
    discovery: { areas: ["ia"], editions: [{ id: "2030", name: "Edição sintética", stages: [
      { id: "event", name: "Realização", kind: "event", start: "2030-12-10", sourceUrl: "https://example.test/closed", checkedAt: stamp },
    ] }] } }),
];
let outage = false;
let catalogueReads = 0;
const catalogue = createServer((req, res) => {
  if (req.headers.authorization !== "Bearer synthetic-radar-search-token") { res.writeHead(401); res.end(); return; }
  catalogueReads++;
  if (outage) { res.writeHead(503); res.end(); return; }
  const calendar = new URL(req.url, "http://127.0.0.1").searchParams.get("view") === "calendar";
  res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify({ version: 3, opportunities: calendar ? records : records.filter(record => record.opportunityStatus === "open") }));
});
const cataloguePort = await bind(catalogue);
// Explicit allowlist: no inherited database, billing, mail, auth or remote API credentials.
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../", import.meta.url), stdio: ["ignore", "pipe", "pipe"],
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=768",
    NEXT_TELEMETRY_DISABLED: "1", APOGEE_LOCAL_PREVIEW: "1", BETTER_AUTH_URL: "http://127.0.0.1:4381",
    BETTER_AUTH_SECRET: "synthetic-radar-search-secret-1234567890", DATABASE_URL: `postgres://unused:unused@127.0.0.1:${databasePort}/unreachable`,
    DATABASE_SSL_MODE: "disable", MEMBERS_EMAIL_ENABLED: "false", RADAR_BILLING_ENABLED: "false", APOGEE_BEHAVIOR_ENABLED: "false",
    RADAR_ACADEMICO_API_URL: `http://127.0.0.1:${cataloguePort}/catalogue`, RADAR_ACADEMICO_API_TOKEN: "synthetic-radar-search-token" },
});
let serverLog = "";
child.stdout.on("data", data => { serverLog += data; });
child.stderr.on("data", data => { serverLog += data; });
const checks = [];
const check = (name, result = true) => { assert.ok(result, name); checks.push(name); console.log(`PASS ${name}`); };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    if (child.exitCode !== null) throw Error(`Local server exited: ${serverLog}`);
    try { if ((await fetch(`${origin}/oportunidades`)).ok) break; } catch { /* Bounded wait for this test's child only. */ }
    if (attempt === 149) throw Error("Local preview startup timed out");
    await pause(100);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  await context.route("**/*", route => {
    if (new URL(route.request().url()).origin !== origin) return route.abort();
    if (!["GET", "HEAD"].includes(route.request().method())) throw Error("Business writes are forbidden in this fixture");
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const go = path => page.goto(origin + path, { waitUntil: "networkidle" });
  const query = async value => {
    await page.getByLabel("Buscar evento, tema ou instituição", { exact: true }).fill(value);
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.waitForURL(url => url.searchParams.get("busca") === value);
    await page.waitForLoadState("networkidle");
  };
  await go("/oportunidades");
  await query("Red Hat Summit Connect");
  check("event-name search ignores original punctuation", await page.getByRole("heading", { name: "Red Hat Summit: Connect 2030 São Paulo", exact: true }).count() === 1);
  check("title result precedes incidental mention", (await page.locator("#opportunity-results article h3").allTextContents())[0].startsWith("Red Hat Summit"));
  await query("tecnologia");
  check("verified themes search the entire catalogue", (await page.getByText("31 oportunidades visíveis", { exact: true }).count()) === 1);
  check("topic suggestions available", await page.locator("#opportunity-search-suggestions option[value='Inteligência artificial']").count() === 1);
  await page.getByRole("link", { name: "Próxima página", exact: true }).click();
  await page.waitForURL(url => url.searchParams.get("pagina") === "2");
  await page.waitForLoadState("networkidle");
  check("pagination reaches every matching result", await page.locator("#opportunity-results article").count() === 7);
  await query("Red Hat");
  check("new query resets pagination", !new URL(page.url()).searchParams.has("pagina"));
  await query("inteligência artificial");
  check("full AI topic finds verified area without title words", await page.getByRole("heading", { name: "Encontro Aurora", exact: true }).count() === 1);
  check("short IA does not match fotografia", await page.getByRole("heading", { name: "Curso de fotografia", exact: true }).count() === 0);
  await query("tecnolgia");
  check("moderate typo recovers technology", await page.getByText("31 oportunidades visíveis", { exact: true }).count() === 1);
  await go("/oportunidades?busca=tecnologia&categoria=bolsas");
  check("category filter remains active", await page.getByRole("heading", { name: "Nenhuma oportunidade encontrada para sua busca.", exact: true }).count() === 1);
  await page.getByRole("button", { name: "Buscar em todas as categorias e locais", exact: true }).click();
  await page.waitForURL(url => !url.searchParams.has("categoria"));
  await page.waitForLoadState("networkidle");
  check("explicit broadening retains query", new URL(page.url()).searchParams.get("busca") === "tecnologia");
  await go("/");
  const homepageText = await page.locator("body").innerText();
  const outsidePreview = records.find(record => record.opportunityStatus === "open" && /^Evento sintético/.test(record.title) && !homepageText.includes(record.title));
  assert.ok(outsidePreview);
  await page.getByLabel("Buscar evento, tema ou instituição", { exact: true }).fill(outsidePreview.title);
  await page.getByRole("button", { name: "Buscar no Radar", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/oportunidades");
  await page.waitForLoadState("networkidle");
  check("homepage finds events outside its highlights", await page.getByRole("heading", { name: outsidePreview.title, exact: true }).count() === 1);
  await query("congresso encerrado");
  check("closed registrations stay outside public feed", await page.getByRole("heading", { name: "Congresso encerrado de IA", exact: true }).count() === 0);
  await page.getByRole("link", { name: "Buscar próximas etapas no calendário de eventos", exact: true }).click();
  await page.waitForURL(url => url.pathname === "/calendarios/eventos");
  await page.waitForLoadState("networkidle");
  check("calendar link preserves query and future stages", (await page.locator("main").innerText()).includes("Congresso encerrado de IA"));
  await go("/oportunidades?busca=Red+Hat");
  await page.screenshot({ path: fileURLToPath(new URL("desktop-search.png", output)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await query("PUC SP");
  check("empty state is usable on mobile", await page.getByRole("heading", { name: "Nenhuma oportunidade encontrada para sua busca.", exact: true }).count() === 1);
  check("mobile has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: fileURLToPath(new URL("mobile-empty.png", output)), fullPage: true });
  await query("Red Hat");
  await page.screenshot({ path: fileURLToPath(new URL("mobile-search.png", output)), fullPage: true });
  await go("/membros/oportunidades?busca=tecnologia");
  check("anonymous member access retains its search on login redirect", new URL(page.url()).pathname === "/membros/entrar" && new URL(page.url()).searchParams.get("next") === "/membros/oportunidades?busca=tecnologia");
  outage = true;
  await go("/oportunidades?busca=tecnologia");
  check("catalogue outages are distinct from no results", await page.getByRole("alert").filter({ hasText: "Catálogo temporariamente indisponível" }).count() === 1);
  check("browser has no uncaught client errors", errors.length === 0);
  check("no database access", databaseConnections === 0);
  check("fixture catalogue was exercised", catalogueReads > 5);
  writeFileSync(new URL("browser-results.json", output), JSON.stringify({ checks, count: checks.length, errors, databaseConnections, catalogueReads }, null, 2));
  console.log(`PASS ${checks.length} browser checks; desktop/mobile; synthetic catalogue; no database connections`);
} finally {
  if (browser) await browser.close();
  // Only the server created by this bounded test is closed, never an existing dev process.
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
  catalogue.closeAllConnections();
  await new Promise(resolve => catalogue.close(resolve));
  await new Promise(resolve => databaseTrap.close(resolve));
  writeFileSync(new URL("preview.log", output), serverLog);
}
