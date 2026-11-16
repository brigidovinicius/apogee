// Operational import of the reviewed, versioned catalogue. Preflight by default.
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";
import { migrateMemberToolbox } from "./member-toolbox-migrate.mjs";

const key = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const normalizedName = value => value.normalize("NFC").trim().toLocaleLowerCase("pt-BR");
function text(value, limit) {
  if (typeof value !== "string" || !value.trim() || value !== value.normalize("NFC").trim() || value.length > limit || /[<>\p{C}]/u.test(value)) throw Error("Texto da curadoria inválido.");
}
function publicUrl(value) {
  text(value, 2048);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || /[\s\\]/u.test(value) ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z][a-z0-9-]*$/i.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) throw Error("URL da curadoria inválida.");
  return url.href;
}
export function validateToolboxCuration(manifest) {
  text(manifest.id, 80);
  if (!key.test(manifest.id) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest.reviewedAt) || new Date(manifest.reviewedAt).toISOString() !== manifest.reviewedAt ||
      !["official-sources-agent-review","synthetic-test"].includes(manifest.reviewMethod) || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.reviewedOn) || !Array.isArray(manifest.categories) || !manifest.categories.length || !Array.isArray(manifest.tools) || !manifest.tools.length) throw Error("Manifesto da curadoria inválido.");
  const slugs = new Set(), urls = new Set(), names = new Set();
  for (const category of manifest.categories) {
    text(category.slug, 80); text(category.name, 80); text(category.description, 240);
    if (!key.test(category.slug) || slugs.has(category.slug) || !Number.isInteger(category.order) || category.order < 0 || category.order > 9999) throw Error("Categoria da curadoria inválida.");
    slugs.add(category.slug);
  }
  for (const tool of manifest.tools) {
    text(tool.name, 100); text(tool.description, 280);
    const url = publicUrl(tool.url); publicUrl(tool.sourceUrl);
    if (!slugs.has(tool.categorySlug) || urls.has(url) || names.has(normalizedName(tool.name)) || tool.conditions !== null ||
        !Number.isInteger(tool.order) || tool.order < 0 || tool.order > 9999) throw Error("Ficha duplicada, categoria ou condições da curadoria inválidas.");
    urls.add(url); names.add(normalizedName(tool.name));
  }
  return manifest;
}

export function curationFingerprint(manifest) {
  validateToolboxCuration(manifest);
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export async function importMemberToolbox(sql, { apply = false, releaseSha, expectedRole = "apogee_app", manifest, expectedSha256 } = {}) {
  validateToolboxCuration(manifest);
  const fingerprint=curationFingerprint(manifest);
  if(apply && expectedSha256!==fingerprint) throw Error("Informe o SHA-256 exato da curadoria revisada; nada foi importado.");
  if(typeof releaseSha!=="string" || !/^[a-f0-9]{40}$/.test(releaseSha))throw Error("Informe o SHA exato do release operacional.");
  const schema = await migrateMemberToolbox(sql, { expectedRole });
  if (schema.pending) throw Error("A migração 0019 deve ser aplicada e conferida antes da curadoria.");
  return sql.begin(async tx => {
    await tx`select set_config('lock_timeout','5s',true)`;
    await tx`select set_config('statement_timeout','60s',true)`;
    await tx`select pg_advisory_xact_lock(hashtext('apogee:member-toolbox-curation'))`;
    const categories = await tx`select id,slug,status from member_tool_category for share`;
    const tools = await tx`select id,name,url,status from member_tool for share`;
    const categoriesBySlug = new Map(categories.map(row => [row.slug, row]));
    const byUrl = new Map(tools.map(row => [row.url, row]));
    const byName = new Map(tools.map(row => [normalizedName(row.name), row]));
    const conflicts = [];
    for (const category of manifest.categories) {
      if (categoriesBySlug.has(category.slug) && categoriesBySlug.get(category.slug).status !== "published") conflicts.push({category:category.slug, reason:"existing_category_not_published"});
    }
    for (const tool of manifest.tools) {
      if (!byUrl.has(publicUrl(tool.url)) && byName.has(normalizedName(tool.name))) conflicts.push({tool:tool.name, reason:"existing_name_with_another_url"});
    }
    const newCategories = manifest.categories.filter(category => !categoriesBySlug.has(category.slug));
    const newTools = manifest.tools.filter(tool => !byUrl.has(publicUrl(tool.url)));
    const result = { actor:"release-import", releaseSha, reviewMethod:manifest.reviewMethod, manifest:manifest.id, sha256:fingerprint, apply,
      newCategories:newCategories.map(c=>c.slug), newTools:newTools.map(t=>t.name),
      preservedTools:manifest.tools.filter(t=>byUrl.has(publicUrl(t.url))).map(t=>({name:t.name,status:byUrl.get(publicUrl(t.url)).status})), conflicts,
      insertedCategories:0, insertedTools:0 };
    if (!apply) return result;
    if (conflicts.length) throw Error("Conflito com curadoria existente. Revise o preflight; nada foi importado.");
    for (const category of newCategories) {
      const inserted = await tx`insert into member_tool_category(id,slug,name,description,status,sort_order,updated_by)
        values(${randomUUID()},${category.slug},${category.name},${category.description},'published',${category.order},null)
        on conflict(slug) do nothing returning id`;
      result.insertedCategories += inserted.length;
    }
    for (const tool of newTools) {
      const [category] = await tx`select id,status from member_tool_category where slug=${tool.categorySlug} for share`;
      if (!category || category.status !== "published") throw Error("Categoria alterada durante a importação; operação revertida.");
      const inserted = await tx`insert into member_tool(id,category_id,name,description,url,conditions,status,sort_order,reviewed_at,reviewed_by,updated_by)
        values(${randomUUID()},${category.id},${tool.name},${tool.description},${publicUrl(tool.url)},null,'published',${tool.order},${manifest.reviewedAt},null,null)
        on conflict(url) do nothing returning id`;
      result.insertedTools += inserted.length;
    }
    return result;
  });
}

async function main() {
  if (process.argv.slice(2).some(arg => arg !== "--apply")) throw Error("Use somente --apply; envie o manifesto revisado pela entrada padrão.");
  if (process.env.DATABASE_SSL_MODE && process.env.DATABASE_SSL_MODE !== "require") throw Error("A importação operacional exige TLS.");
  const input=readFileSync(0,"utf8");
  if(Buffer.byteLength(input,"utf8")>131072)throw Error("Manifesto grande demais.");
  const manifest=JSON.parse(input);
  validateToolboxCuration(manifest);
  if(manifest.reviewMethod!=="official-sources-agent-review")throw Error("Somente curadoria conferida nas fontes oficiais pode ser importada operacionalmente.");
  const { url, options } = databaseOptions(), sql = postgres(url, { ...options, connect_timeout:10 });
  try { console.log(JSON.stringify(await importMemberToolbox(sql, { apply:process.argv.includes("--apply"), releaseSha:process.env.APOGEE_RELEASE_SHA, manifest, expectedSha256:process.env.APOGEE_TOOLBOX_CURATION_SHA256 }))); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Curadoria não aplicada. Confira release, migração, manifesto e conflitos no preflight. Nenhum segredo foi exibido."); process.exitCode=1;
});
