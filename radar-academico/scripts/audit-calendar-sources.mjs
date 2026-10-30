// Explicit, read-only network audit. Uses exactly the same robots/SSRF/rate limits as ingestion.
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";

if (Object.keys(process.env).some(key => /^DATABASE.*URL$/.test(key) && process.env[key])) throw new Error("Auditoria exige processo sem credenciais de banco");
const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "../.local/radar-calendar/source-audit");
await mkdir(output, { recursive: true });
const server = await createServer({ root, configFile: false, cacheDir: path.join(output, "vite-cache"),
  resolve: { alias: { "@": path.join(root, "src") } }, server: { middlewareMode: true, hmr: false },
  appType: "custom", optimizeDeps: { noDiscovery: true } });
const rows = [];
try {
  const { fetchOfficialResource } = await server.ssrLoadModule("/src/lib/ingestion/fetch-source.ts");
  const { CALENDAR_SOURCES, calendarAuditSource } = await server.ssrLoadModule("/src/lib/ingestion/calendar-sources.ts");
  const { normalizeCalendarSource } = await server.ssrLoadModule("/src/lib/ingestion/normalize-calendar-sources.ts");
  for (const spec of CALENDAR_SOURCES) {
    if (process.argv.length > 2 && !process.argv.slice(2).includes(spec.id)) continue;
    const row = { sourceId: spec.id, url: spec.url, checkedAt: new Date().toISOString() };
    try {
      const resource = await fetchOfficialResource(spec.url, calendarAuditSource(spec.id));
      if (!/text\/html|application\/xhtml/i.test(resource.contentType)) throw new Error("Formato HTML não confirmado");
      await writeFile(path.join(output, `${spec.id}.html`), resource.body);
      Object.assign(row, { fetched: true, sha256: resource.hash, bytes: resource.body.length });
      const candidates = normalizeCalendarSource(resource.body.toString("utf8"), calendarAuditSource(spec.id));
      await writeFile(path.join(output, `${spec.id}.candidates.json`), JSON.stringify(candidates, null, 2));
      Object.assign(row, { parsed: true, candidates: candidates.length, stages: candidates.reduce((n, item) => n + item.discovery.editions.flatMap(e => e.stages).length, 0) });
    } catch (error) { Object.assign(row, { fetched: row.fetched || false, parsed: false, reason: error.message }); }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  await writeFile(path.join(output, "fetch-results.json"), JSON.stringify({ databaseAccess: false, sources: rows }, null, 2));
  if (!rows.length || rows.some(row => !row.parsed)) process.exitCode = 1;
} finally { await server.close(); }
