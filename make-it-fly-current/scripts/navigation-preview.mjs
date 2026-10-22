import { readFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { spawn } from "node:child_process";
import postgres from "postgres";
import { localPreviewEnv, previewCommand, previewHeaders } from "../lib/navigation/local-preview.mjs";

const [mode, configPath, metricsPath] = process.argv.slice(2);
if (!configPath) throw new Error("Usage: navigation-preview.mjs build|serve private-config.json [metrics.jsonl]");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const env = {
  ...Object.fromEntries(["PATH", "TMPDIR", "LANG", "USER", "SHELL"].filter(k => process.env[k]).map(k => [k, process.env[k]])),
  ...localPreviewEnv(config, mode),
};
// Explicit, loopback-only browser test: no Google credentials or remote callback changes.
const oauthFixture = process.argv.includes("--test-google-provider") && mode === "serve"
  ? (await import("../tests/browser/google-provider-fixture.mjs")).createGoogleProviderFixture() : null;
if (oauthFixture) await new Promise(resolve => oauthFixture.provider.listen(4384, "127.0.0.1", resolve));
const sql = postgres(env.DATABASE_URL, { ssl: false, max: 1 });
const catalogue = createServer(async (req, res) => {
  if (req.url !== "/catalogue" || req.headers.authorization !== `Bearer ${config.RADAR_ACADEMICO_API_TOKEN}`) {
    res.writeHead(404); res.end(); return;
  }
  try {
    const rows = await sql`select payload from navigation_test_catalogue order by id`;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify({ version: 3, opportunities: rows.map(row => row.payload) }));
  } catch { res.writeHead(503); res.end(); }
});
await new Promise(resolve => catalogue.listen(4382, "127.0.0.1", resolve));

let proxy;
if (mode === "serve") {
  // Keep production auth's trusted-IP checks active on the compiled fixture.
  proxy = createServer(async (req, res) => {
    if (oauthFixture && await oauthFixture.handle(req, res)) return;
    const upstream = request({ hostname: "127.0.0.1", port: 4383, method: req.method,
      path: req.url, headers: previewHeaders(req.headers) }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(503); res.end(); });
    res.on("close", () => upstream.destroy());
    req.pipe(upstream);
  });
  await new Promise(resolve => proxy.listen(4381, "127.0.0.1", resolve));
  if (metricsPath) {
    env.APOGEE_PREVIEW_METRICS_FILE = metricsPath;
    env.NODE_OPTIONS += ` --import ${JSON.stringify(new URL("navigation-preview-metrics.mjs", import.meta.url).href)}`;
  }
}
const child = spawn(process.execPath, previewCommand(mode), {
  cwd: new URL("../", import.meta.url), env, stdio: "inherit",
});
console.log(`[navigation-preview] ${mode}; pid=${child.pid}; loopback only; no deployment`);
let closing = false;
async function cleanup() {
  if (closing) return; closing = true;
  catalogue.close(); proxy?.close(); oauthFixture?.provider.close(); await sql.end();
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", async error => { console.error(error.message); await cleanup(); process.exitCode = 1; });
child.once("exit", async code => { await cleanup(); process.exitCode = code ?? 1; });
