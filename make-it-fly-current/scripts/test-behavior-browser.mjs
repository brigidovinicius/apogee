// Run after a local build, inside the global npm FIFO. No real credentials/data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.BEHAVIOR_PLAYWRIGHT_MODULE || "playwright");
const probe = createServer();
probe.listen(0, "127.0.0.1"); await once(probe, "listening");
const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const output = new URL("../outputs/behavior-validation/", import.meta.url);
mkdirSync(output, { recursive: true });
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: new URL("../", import.meta.url), stdio: ["ignore", "pipe", "pipe"],
  env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR, NODE_ENV: "production", NODE_OPTIONS: "--max-old-space-size=768", NEXT_TELEMETRY_DISABLED: "1", APOGEE_LOCAL_PREVIEW: "1", APOGEE_BEHAVIOR_ENABLED: "true", BETTER_AUTH_URL: "http://127.0.0.1:4381", BETTER_AUTH_SECRET: "synthetic-behavior-test-secret-1234567890", DATABASE_URL: "postgres://unused:unused@127.0.0.1:1/unreachable", DATABASE_SSL_MODE: "disable", MEMBERS_EMAIL_ENABLED: "false", RADAR_BILLING_ENABLED: "false" },
});
let serverLog = ""; child.stdout.on("data", data => { serverLog += data; }); child.stderr.on("data", data => { serverLog += data; });
let browser;
const measured = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function capture(context, rows) {
  await context.route("**/*", async route => {
    const request = route.request();
    if (new URL(request.url()).origin !== origin) return route.abort();
    if (new URL(request.url()).pathname === "/api/behavior") {
      rows.push({ headers: await request.allHeaders(), ...request.postDataJSON() });
      return route.fulfill({ status: 202, contentType: "application/json", body: '{"received":true}' });
    }
    if (request.method() === "POST") throw Error("Business writes are forbidden in this browser fixture");
    return route.continue();
  });
}
try {
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null) throw Error(`Local server exited: ${serverLog}`);
    try { if ((await fetch(origin)).ok) break; } catch { /* Waiting for our own child. */ }
    if (attempt === 149) throw Error("Local preview startup timed out");
    await pause(100);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  await context.addCookies([{ name: "synthetic_private_cookie", value: "must-not-be-sent", url: origin }]);
  await capture(context, measured);
  const page = await context.newPage();
  await page.goto(`${origin}/?email=person@example.test&token=synthetic-secret`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Permitir medição", exact: true }).waitFor();
  await pause(1200); assert.equal(measured.length, 0);
  await page.screenshot({ path: fileURLToPath(new URL("desktop-consent.png", output)) });
  await page.getByRole("button", { name: "Recusar", exact: true }).click();
  await pause(1200); assert.equal(measured.length, 0);
  await page.getByRole("button", { name: "Preferências de medição" }).click();
  await page.getByRole("button", { name: "Permitir medição", exact: true }).click();
  await pause(1200); assert.ok(measured.flatMap(batch => batch.events).some(event => event.page === "home" && event.event === "page_view"));
  await page.goto(`${origin}/oportunidades?busca=private-search`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Preferências de medição" }).waitFor();
  // A synthetic control exercises delegation without saving a real opportunity.
  await page.evaluate(() => { const button = document.createElement("button"); button.dataset.behaviorAction = "save"; button.textContent = "Synthetic save"; document.body.append(button); });
  await page.getByRole("button", { name: "Synthetic save" }).click();
  await pause(1200);
  assert.ok(measured.flatMap(batch => batch.events).some(event => event.page === "radar_list" && event.target === "save"));
  await page.goto(`${origin}/makeitfly/participar`, { waitUntil: "domcontentloaded" });
  await page.getByTitle("Formulário de aplicação Make It Fly").waitFor();
  await page.getByRole("button", { name: "Preferências de medição" }).waitFor();
  const popupPromise = context.waitForEvent("page");
  await page.getByRole("link", { name: "Abrir em nova aba", exact: false }).click();
  const popup = await popupPromise; await popup.close();
  await pause(1200);
  assert.ok(measured.flatMap(batch => batch.events).some(event => event.event === "action" && event.target === "application_open"));
  await page.goto(`${origin}/loja`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Comprar / }).first().click();
  const purchase = page.getByRole("dialog", { name: "Novos drops em breve" });
  await purchase.getByLabel("Nome", { exact: true }).fill("Pessoa Sintética");
  await purchase.getByLabel("E-mail", { exact: true }).fill("person@example.test");
  await purchase.getByLabel("Telefone", { exact: true }).fill("11999999999");
  await purchase.getByRole("button", { name: "Fechar", exact: true }).click();
  await pause(1200);
  assert.ok(measured.flatMap(batch => batch.events).some(event => event.event === "action" && event.target === "store_interest"));
  await page.getByRole("button", { name: "Preferências de medição" }).click();
  await page.getByRole("button", { name: "Recusar", exact: true }).click();
  const afterRefusal = measured.length;
  await page.goto(origin, { waitUntil: "domcontentloaded" }); await pause(1200);
  assert.equal(measured.length, afterRefusal);
  for (const batch of measured) {
    assert.equal(batch.headers.cookie, undefined); assert.equal(batch.headers.referer, undefined);
    assert.doesNotMatch(JSON.stringify(batch.events), /person@example|synthetic-secret|private-search|Pessoa Sintética|11999999999|journeyId|sessionId|userId/);
    for (const event of batch.events) assert.deepEqual(Object.keys(event).sort(), ["device", "event", "page", "target"]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Preferências de medição" }).click();
  const panel = page.getByRole("complementary", { name: "Preferências de medição de uso" });
  const bounds = await panel.boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
  await page.screenshot({ path: fileURLToPath(new URL("mobile-consent.png", output)) });
  await context.close();
  const refused = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const refusedCalls = []; await capture(refused, refusedCalls);
  await refused.addInitScript(() => { localStorage.setItem("apogee:behavior-choice:v1", "allow"); Object.defineProperty(navigator, "globalPrivacyControl", { get: () => true }); });
  const refusedPage = await refused.newPage();
  await refusedPage.goto(origin, { waitUntil: "domcontentloaded" });
  await refusedPage.getByText("Medição de uso desativada pelo navegador", { exact: true }).waitFor();
  await pause(1200); assert.equal(refusedCalls.length, 0); await refused.close();
  writeFileSync(new URL("browser-events.json", output), JSON.stringify(measured.map(({ events }) => ({ events })), null, 2));
  console.log("PASS production-browser consent/refusal/revocation/GPC, private input exclusion, Radar action, no cookies/Referer, desktop/mobile bounds");
} finally {
  if (browser) await browser.close();
  if (child.exitCode === null && child.signalCode === null) { child.kill("SIGTERM"); await once(child, "exit"); }
  writeFileSync(new URL("preview.log", output), serverLog);
}
