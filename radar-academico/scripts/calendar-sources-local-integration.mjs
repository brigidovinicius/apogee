// Real ingestion, restricted to the identified local editorial database and successful live audits.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import { createServer } from "vite";

assert(!Object.keys(process.env).some(k => /^DATABASE.*URL$/.test(k) && process.env[k]), "Não herdar credenciais de banco");
const root = fileURLToPath(new URL("../", import.meta.url));
const state = path.join(root, "../.local/radar-calendar");
const config = JSON.parse(await readFile(path.join(state, "config.json"), "utf8"));
const editorial = JSON.parse(await readFile(path.join(state, "editorial-config.json"), "utf8"));
assert.equal(editorial.marker, "apogee-radar-editorial-local-v1");
for (const [variable, user] of [["DATABASE_READER_URL", "radar_reader"], ["DATABASE_EDITOR_URL", "radar_editor"]]) {
  const url = new URL(editorial[variable]);
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "48763");
  assert.equal(url.pathname, "/radar_calendar_editorial_local"); assert.equal(url.username, user);
}
const admin = new pg.Client({ host: "127.0.0.1", port: 48763, database: "radar_calendar_editorial_local", user: "radar_local_admin", password: config.ADMIN_PASSWORD });
await admin.connect();
let server;
try {
  assert.equal((await admin.query("show data_directory")).rows[0].data_directory, path.join(state, "pgdata"));
  assert.equal((await admin.query("select marker from radar_local_environment")).rows[0].marker, editorial.marker);
  const audit = JSON.parse(await readFile(path.join(state, "source-audit/fetch-results.json"), "utf8"));
  const approved = audit.sources.filter(row => row.fetched && row.parsed && Date.now() - Date.parse(row.checkedAt) < 86_400_000);
  assert.deepEqual(approved.map(row => row.sourceId).sort(), ["obmep-calendar-2026", "obi-calendar-2026"].sort(), "Somente fontes com coleta real aprovada");
  process.env.DATABASE_EDITOR_URL = editorial.DATABASE_EDITOR_URL;
  process.env.DATABASE_READER_URL = editorial.DATABASE_READER_URL;
  process.env.DATABASE_SSL = "false";
  server = await createServer({ root, configFile: false, cacheDir: path.join(state, "source-audit/vite-integration"),
    resolve: { alias: { "@": path.join(root, "src") } }, server: { middlewareMode: true, hmr: false }, appType: "custom", optimizeDeps: { noDiscovery: true } });
  const { runOfficialSourceIngestion } = await server.ssrLoadModule("/src/lib/ingestion/index.ts");
  const { listCalendarCatalogue, listLiveCatalogue } = await server.ssrLoadModule("/src/lib/db/live-catalogue.ts");
  const results = [];
  for (const row of approved) {
    await admin.query("update official_sources set active=true,verification_status='verified',audited_at=now(),audited_by='local-calendar-validation',audit_evidence_url=base_url where id=$1", [row.sourceId]);
    const first = await runOfficialSourceIngestion({ sourceId: row.sourceId, maxPages: 1 });
    assert.equal(first.discovered, 1); assert.equal(first.sources[0].failed, 0);
    const before = (await admin.query("select id from opportunities where official_source_id=$1 and deleted_at is null", [row.sourceId])).rows;
    assert.equal(before.length, 1);
    const again = await runOfficialSourceIngestion({ sourceId: row.sourceId, maxPages: 1 });
    assert.equal(again.discovered, 1); assert.equal(again.sources[0].failed, 0);
    assert.deepEqual((await admin.query("select id from opportunities where official_source_id=$1 and deleted_at is null", [row.sourceId])).rows, before);
    const calendar = (await listCalendarCatalogue()).find(item => item.id === before[0].id);
    assert(calendar); assert.equal(calendar.opportunityStatus, "closed");
    assert(!(await listLiveCatalogue()).some(item => item.id === calendar.id), "Não reabrir inscrição encerrada");
    results.push({ sourceId: row.sourceId, opportunityId: calendar.id, stages: calendar.discovery.editions.flatMap(e => e.stages).length, duplicateCount: 0, status: "closed", visibleInCalendar: true, visibleAsOpen: false });
    console.log(JSON.stringify(results.at(-1)));
  }
  const blocked = (await admin.query("select id,active,verification_status from official_sources where id=any($1::text[]) order by id", [["comvest-vestibular-2027", "fuvest-vestibular-2027"]])).rows;
  assert(blocked.every(row => !row.active && row.verification_status === "pending"));
  await writeFile(path.join(state, "source-audit/local-integration.json"), JSON.stringify({ checkedAt: new Date().toISOString(), localOnly: true, results, blocked }, null, 2));
} finally { await server?.close(); await admin.end(); }
