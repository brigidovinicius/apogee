// Compiled Next server, synthetic configuration, disposable loopback only.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import { resolve } from "node:path";

const origin = "https://www.apogee.community";
let databaseConnections = 0;
const databaseTrap = createServer(socket => { databaseConnections++; socket.destroy(); });
await new Promise(resolve => databaseTrap.listen(0, "127.0.0.1", resolve));
const probe = createServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const child = spawn(process.execPath, [resolve(".next/standalone/server.js")], {
  cwd: resolve(".next/standalone"),
  env: {
    PATH: process.env.PATH, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), NEXT_TELEMETRY_DISABLED: "1",
    APPLICATION_ORIGIN: origin, APPLICATION_SIGNING_SECRET: "synthetic-body-http-secret-at-least-32-characters",
    SUPABASE_URL: "https://synthetic.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_synthetic01234567890123456789",
    BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: "synthetic-body-http-auth-secret-at-least-32-characters",
    DATABASE_URL: `postgres://synthetic:synthetic@127.0.0.1:${databaseTrap.address().port}/unused`, DATABASE_SSL_MODE: "disable",
  }, stdio: ["ignore", "pipe", "pipe"],
});
const exit = once(child, "exit");
let logs = "";
child.stdout.on("data", data => { logs = (logs + data).slice(-4000); });
child.stderr.on("data", data => { logs = (logs + data).slice(-4000); });
async function incomplete(path, expected, waitForTimeout) {
  const start = performance.now();
  const request = httpRequest({ host: "127.0.0.1", port, path, method: "POST", headers: {
    origin, "content-type": "application/json", "content-length": "100", connection: "close",
  } });
  const guard = setTimeout(() => request.destroy(new Error("HTTP test guard fired")), 9000);
  try {
    const responsePromise = once(request, "response");
    request.write("{"); // No EOF: neither JSON parsing nor persistence can succeed.
    const [response] = await responsePromise;
    response.resume(); await once(response, "end");
    const elapsed = performance.now() - start;
    assert.equal(response.statusCode, expected);
    if (waitForTimeout) assert.ok(elapsed >= 4500 && elapsed < 8500);
    else assert.ok(elapsed < 2000, "private endpoints must reject before waiting for body EOF");
    assert.equal(databaseConnections, 0, "no database is needed for these rejection paths");
    console.log(`PASS: ${path} returned ${expected} after ${Math.round(elapsed)} ms`);
  } finally { clearTimeout(guard); request.destroy(); }
}
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(`Standalone exited: ${logs}`);
    try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) }); ready = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  assert.ok(ready);
  // SEC-04: schema rejection must precede quota/database access, even under repetition.
  for (let i = 0; i < 100; i++) {
    const response = await fetch(`http://127.0.0.1:${port}/api/radar/alerts`, {
      method: "POST", headers: { origin, "Content-Type": "application/json" },
      body: '{"action":"subscribe"}', signal: AbortSignal.timeout(2000),
    });
    assert.equal(response.status, 400);
  }
  assert.equal(databaseConnections, 0);
  console.log("PASS: /api/radar/alerts rejected 100 malformed subscriptions before any database connection");
  await incomplete("/api/members/invitations", 401, false);
  await incomplete("/api/members/verification", 401, false);
  await incomplete("/api/applications", 408, true);
  await incomplete("/api/journey", 408, true);
} finally {
  child.kill("SIGTERM");
  const guard = setTimeout(() => child.kill("SIGKILL"), 3000);
  try { await exit; } finally { clearTimeout(guard); }
  await new Promise(resolve => databaseTrap.close(resolve));
}
