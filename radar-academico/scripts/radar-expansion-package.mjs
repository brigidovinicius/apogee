import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = new URL("../references/radar-expansion-20261030/", import.meta.url);
export async function expansionPackage() {
  const names = ["targets.json", "editions.json", "luma-events.json"];
  const raw = [];
  for (const name of names) raw.push(await readFile(new URL(name, root), "utf8"));
  const [targets, editions, luma] = raw.map(JSON.parse);
  // Bind the audit to extraction/transport behavior as well as the curated data.
  for (const path of ["src/lib/ingestion/normalize-expansion.ts", "src/lib/ingestion/structured-events.ts",
    "src/lib/ingestion/fetch-source.ts", "src/lib/ingestion/programme-catalogue.ts", "src/lib/discovery/daily-discovery.ts",
    "scripts/radar-expansion-package.mjs"]) raw.push(await readFile(new URL("../" + path, import.meta.url), "utf8"));
  const sources = [...editions.map(call => ({ id: call.id, name: call.name, organizer: call.organizer, url: call.url })),
    ...luma.map(call => ({ id: call.id, name: call.title, organizer: call.organizer, url: call.url }))];
  return { manifestHash: createHash("sha256").update(raw.join("\n")).digest("hex"), targets, sources };
}
/** Only inserts audited records. Existing disabled sources/targets and editorial decisions win. */
export async function installExpansionPackage(client, pkg, audit, now = new Date()) {
  if (audit.complete !== true || audit.manifestHash !== pkg.manifestHash || !Array.isArray(audit.results) ||
    !Number.isFinite(Date.parse(audit.checkedAt)) || Date.parse(audit.checkedAt) > +now + 60000 || +now - Date.parse(audit.checkedAt) > 86400000) {
    throw Error("Auditoria ausente, divergente ou vencida; execute a leitura oficial novamente");
  }
  let targetsAdded = 0, targetsEnabled = 0, sourcesAdded = 0;
  for (const target of pkg.targets) {
    const checked = audit.results.some(row => row.kind === "target" && row.id === target.id && row.url === target.url && row.outcome === "checked");
    const enabled = target.identity_reviewed && checked;
    const result = await client.query(`insert into discovery_targets
      (id,name,organizer,kind,official_url,topics,priority,enabled,check_interval_hours,evidence_url,
       official_verified_at,official_verified_url,official_verified_by,official_review_note,notes)
      select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,case when $8 then $11::timestamptz else null end,
       case when $8 then $5 else null end,case when $8 then 'codex:operator-authorized-agent' else null end,$12,$13
      where not exists(select 1 from discovery_targets where rtrim(official_url,'/')=rtrim($5,'/'))
      on conflict(id) do nothing returning id`,
      [target.id,target.name,target.organizer,target.kind,target.url,target.topics,target.priority,enabled,target.interval_hours,
        target.evidence_url,audit.checkedAt,target.review_note,
        `Expansão 30/10/2026. Situação pesquisada: ${target.registration_status}. ${enabled ? "Autoria e leitura pública/robots conferidas; monitor diário." : "Pendente: autoria ou acesso não confirmado. Não se apresenta como monitor ativo."}`]);
    if (result.rows.length) { targetsAdded++; if (enabled) targetsEnabled++; }
  }
  for (const source of pkg.sources) {
    if (!audit.results.some(row => row.kind === "source" && row.id === source.id && row.url === source.url && row.outcome === "checked")) continue;
    const url = new URL(source.url);
    const result = await client.query(`insert into official_sources
      (id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,
       extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,crawl_interval_hours,
       robots_checked_at,verification_method,verification_evidence_url,verified_at,verified_by,notes)
      select $1,$2,$3,'','official_reference',$4,$5,$6,$7,'html',array['mixed'],'{}','{}',70,true,'verified',24,
       $8::timestamptz,'operator_authorized_agent',$4,$8::timestamptz,'codex:operator-authorized-agent',$9
      where not exists(select 1 from official_sources where rtrim(base_url,'/')=rtrim($4,'/'))
      on conflict(id) do nothing returning id`,
      [source.id,source.name,source.organizer,source.url,[url.hostname],[url.pathname],[source.url],audit.checkedAt,
        "Edição exata: autoria pública revisada, robots e leitura no fetcher de produção confirmados; normalizador validou fatos, inscrição e fonte. Não autoriza outros organizadores no mesmo host. Preservar curadoria, exclusões e decisões existentes."]);
    sourcesAdded += result.rows.length;
  }
  return { targetsAdded, targetsEnabled, targetsPending: targetsAdded - targetsEnabled, sourcesAdded };
}
async function main() {
  const pkg = await expansionPackage();
  const auditPath = process.argv.find(arg => arg.startsWith("--audit="))?.slice(8);
  if (!process.argv.includes("--apply")) {
    console.log(JSON.stringify({ manifestHash: pkg.manifestHash, targets: pkg.targets.length, scientificOlympiads: pkg.targets.filter(row => row.scientific_olympiad).length, sources: pkg.sources.length, mode: "plan_only" })); return;
  }
  if (!auditPath || !process.env.DATABASE_EDITOR_URL) throw Error("Informe --audit e DATABASE_EDITOR_URL; segredos não devem ser passados na linha de comando");
  const audit = JSON.parse(await readFile(auditPath, "utf8"));
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_EDITOR_URL });
  try {
    await client.connect(); await client.query("begin");
    await client.query("select set_config('app.is_admin','true',true)");
    const result = await installExpansionPackage(client, pkg, audit);
    await client.query("commit"); console.log(JSON.stringify(result));
  } catch (error) { await client.query("rollback").catch(() => {}); throw error; }
  finally { await client.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Pacote não aplicado. Verifique auditoria, autorização e configuração do ambiente; transação revertida."); process.exitCode = 1;
});
