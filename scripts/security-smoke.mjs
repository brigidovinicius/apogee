import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { cp, access } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const app = process.argv[2];
const root = process.cwd();
const standalone = resolve(root, ".next/standalone");
await access(resolve(standalone, "server.js"));
await cp(resolve(root, "public"), resolve(standalone, "public"), { recursive: true });
await cp(resolve(root, ".next/static"), resolve(standalone, ".next/static"), { recursive: true });
const probe = createServer();
await new Promise((done) => probe.listen(0, "127.0.0.1", done));
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const server = spawn(process.execPath, [resolve(standalone, "server.js")], {
  cwd: standalone,
  // Do not inherit developer credentials or connect to any real backend.
  env: { PATH: process.env.PATH, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1", ADMIN_SESSION_SECRET: "synthetic-smoke-key-only-".repeat(3) },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-8000); });
server.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-8000); });
const url = `http://127.0.0.1:${port}`;
const get = (path, options = {}) => fetch(url + path, { ...options, redirect: "manual", signal: AbortSignal.timeout(5000) });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error(`Standalone exited: ${logs}`);
    try { await get("/"); ready = true; break; } catch { await new Promise((done) => setTimeout(done, 500)); }
  }
  assert.ok(ready, "standalone must start");
  const home = await get("/");
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.match(home.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.ok(home.headers.get("strict-transport-security"));
  if (app === "radar-academico") {
    assert.equal(home.status, 307);
    assert.equal(home.headers.get("location"), "https://apogee.community/oportunidades");
    const detail = await get("/oportunidades/00000000-0000-0000-0000-000000000000");
    assert.equal(detail.status, 307);
    assert.equal(detail.headers.get("location"), "https://apogee.community/membros/oportunidades");
    assert.equal((await get("/api/public/opportunities")).status, 401);
    assert.equal((await get("/api/cron/ingest-official-sources", { method: "POST" })).status, 401);
    assert.equal((await get("/api/health")).status, 200);
    const admin = await get("/admin/fontes", { headers: { Cookie: "radar_admin=NaN.zz" } });
    assert.equal(admin.status, 307);
    assert.equal(admin.headers.get("location"), "/admin/login");
  } else {
    assert.equal(home.status, 200);
    const html = await home.text();
    const asset = html.match(/src="([^\"]*\/_next\/static\/[^\"]+\.js)"/);
    assert.ok(asset, "page includes a JavaScript asset");
    assert.equal((await get(asset[1])).status, 200);
    if (app === "make-it-fly-current") {
      assert.equal((await get("/oportunidades")).status, 200);
      const member = await get("/membros/oportunidades");
      assert.ok([302, 303, 307, 308].includes(member.status));
    } else {
      assert.equal((await get("/api/pre-inscricao", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 403);
    }
  }
  console.log(`Standalone smoke OK: ${app}`);
} finally {
  server.kill("SIGTERM");
  await new Promise((done) => { if (server.exitCode !== null) return done(); const timer = setTimeout(() => server.kill("SIGKILL"), 3000); server.once("exit", () => { clearTimeout(timer); done(); }); });
}
