// Only disposable loopback listeners. No TLS, live upstream, database or env files.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile } from "node:fs/promises";
import { createServer as httpServer } from "node:http";
import { connect, createServer as netServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const binary = process.env.CADDY_BIN;
if (!binary) throw new Error("Defina CADDY_BIN; nenhum download é feito pelo teste.");
const adapted = JSON.parse(execFileSync(binary, ["adapt", "--config", "infra/site/Caddyfile", "--adapter", "caddyfile"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
const server = Object.values(adapted.apps.http.servers)[0];
assert.equal(server.read_header_timeout, 10_000_000_000);
assert.equal(server.read_timeout, 35_000_000_000);
const root = await mkdtemp(join(tmpdir(), "body-sec03-proxy-"));
let completedRequests = 0;
const upstream = httpServer((request, response) => {
  request.on("error", () => {});
  request.on("data", () => {});
  request.on("end", () => { completedRequests++; response.writeHead(200); response.end("ok"); });
});
await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
const probe = netServer();
await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const config = join(root, "caddy.json");
await writeFile(config, JSON.stringify({ admin: { disabled: true },
  apps: { http: { servers: { isolated: {
    listen: [`127.0.0.1:${port}`],
    read_header_timeout: server.read_header_timeout, read_timeout: server.read_timeout,
    routes: [{ handle: [{ handler: "reverse_proxy", upstreams: [{ dial: `127.0.0.1:${upstream.address().port}` }] }] }],
  } } } },
}));
const child = spawn(binary, ["run", "--config", config], {
  env: { PATH: process.env.PATH, HOME: root, XDG_CONFIG_HOME: root, XDG_DATA_HOME: root },
  stdio: ["ignore", "ignore", "pipe"],
});
let startupError = ""; child.stderr.on("data", data => { startupError += data; });
const childExit = once(child, "exit");
async function rawRequest(text, limitMs) {
  const start = performance.now(); let data = ""; let guardFired = false;
  const socket = connect(port, "127.0.0.1");
  const guard = setTimeout(() => { guardFired = true; socket.destroy(); }, limitMs);
  try {
    await new Promise((resolve, reject) => {
      socket.on("connect", () => socket.write(text));
      socket.on("data", chunk => { data += chunk.toString(); });
      socket.on("error", reject); socket.on("close", resolve);
    });
    assert.equal(guardFired, false, "Caddy must close the connection before the test guard");
    return { elapsed: performance.now() - start, data };
  } finally { clearTimeout(guard); socket.destroy(); }
}
try {
  for (let i = 0; ; i++) {
    try { const socket = connect(port, "127.0.0.1"); await once(socket, "connect"); socket.destroy(); break; }
    catch { if (i >= 50 || child.exitCode !== null) throw new Error(`Caddy did not start: ${startupError}`); await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  const complete = await rawRequest("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}", 5000);
  assert.match(complete.data, /^HTTP\/1\.1 200/);
  assert.equal(completedRequests, 1);
  console.log("PASS: complete requests reach the isolated upstream");
  const headers = await rawRequest("POST / HTTP/1.1\r\nHost: localhost\r\nX-Unfinished:", 15_000);
  assert.ok(headers.elapsed >= 8500 && headers.elapsed < 15_000);
  assert.ok(!headers.data || /^HTTP\/1\.1 [45]/.test(headers.data));
  console.log(`PASS: unfinished headers closed after ${Math.round(headers.elapsed)} ms`);
  const body = await rawRequest("POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 10000\r\nConnection: close\r\n\r\n{", 40_000);
  assert.ok(body.elapsed >= 33_500 && body.elapsed < 40_000);
  assert.equal(completedRequests, 1, "a truncated upload must not reach the upstream end handler");
  // Caddy 2.10.2 can close this failed read with an empty 200 response. The
  // connection deadline is the edge guarantee; app readers return explicit 408.
  console.log(`PASS: unfinished body closed after ${Math.round(body.elapsed)} ms; upstream did not complete it; edge response: ${body.data.split("\r\n")[0] || "closed"}`);
} finally {
  child.kill("SIGTERM"); await childExit;
  upstream.closeAllConnections(); await new Promise(resolve => upstream.close(resolve));
}
