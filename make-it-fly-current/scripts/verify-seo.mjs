import assert from "node:assert/strict";

const origin = process.argv[2] || "http://127.0.0.1:3107";
const localOrigin = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname);
const canonicalOrigin = "https://www.apogee.community";
const publicPaths = ["/", "/oportunidades", "/galeria", "/loja", "/makeitfly"];
const titles = new Set();

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(match => [match[1], match[2]]));
}
function metaValues(html, name) {
  return [...html.matchAll(/<meta\b[^>]*>/g)].map(match => attributes(match[0]))
    .filter(tag => tag.name === name || tag.property === name).map(tag => tag.content);
}

async function read(path) {
  const response = await fetch(new URL(path, origin), { signal: AbortSignal.timeout(35_000) });
  return { response, html: await response.text() };
}

for (const path of publicPaths) {
  const { response, html } = await read(path);
  assert.equal(response.status, 200, `${path}: public page must return 200`);
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title && !titles.has(title), `${path}: title must be descriptive and unique`);
  titles.add(title);
  assert.ok(metaValues(html, "description")[0], `${path}: missing description`);
  assert.ok(metaValues(html, "robots").every(value => !value.includes("noindex")), `${path}: public page is noindex`);
  const canonical = [...html.matchAll(/<link\b[^>]*>/g)].map(match => attributes(match[0])).filter(tag => tag.rel === "canonical");
  assert.equal(canonical.length, 1, `${path}: expected one canonical`);
  assert.equal(new URL(canonical[0].href).href, new URL(path, canonicalOrigin).href, `${path}: canonical mismatch`);
  assert.deepEqual(metaValues(html, "og:title"), [title], `${path}: Open Graph title mismatch`);
  assert.deepEqual(metaValues(html, "twitter:title"), [title], `${path}: Twitter title mismatch`);
  assert.deepEqual(metaValues(html, "og:site_name"), ["Apogee"]);
  assert.match(html, /<html[^>]*lang="pt-BR"/);
  for (const match of html.matchAll(/<img\b[^>]*>/g)) assert.ok("alt" in attributes(match[0]), `${path}: image missing alt`);
  if (path === "/") {
    const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)?.[1]);
    assert.equal(data["@graph"][0]["@type"], "WebSite");
    assert.equal(data["@graph"][0].name, "Apogee");
    assert.equal(data["@graph"][1]["@type"], "Organization");
  }
  console.log(`PASS ${path}: title, canonical, social metadata, language and images`);
}

for (const path of ["/membros/entrar", "/membros/cadastro", "/makeitfly/participar", "/home-robonauta", "/membros", "/admin", "/gerenciar-galeria", "/login"]) {
  const { response, html } = await read(path);
  if (response.status >= 500) {
    assert.ok(localOrigin, `${path}: server error ${response.status}`);
    console.warn(`LIMIT ${path}: local configuration unavailable (HTTP ${response.status}); checking only noindex, not authentication functionality`);
  }
  assert.ok(metaValues(html, "robots").some(value => value.includes("noindex")), `${path}: expected noindex`);
  console.log(`PASS ${path}: excluded from indexing`);
}

for (const path of ["/api/gallery", "/api/applications-export"]) {
  const { response } = await read(path);
  assert.ok(localOrigin || response.status < 500, `${path}: server error ${response.status}`);
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow", `${path}: API must not be indexed`);
  console.log(`PASS ${path}: API noindex (HTTP ${response.status})`);
}

const missing = await read("/pagina-inexistente-auditoria-seo");
assert.equal(missing.response.status, 404);
assert.ok(metaValues(missing.html, "robots").some(value => value.includes("noindex")));
const invalidGallery = await read("/galeria?pagina=0");
assert.ok(metaValues(invalidGallery.html, "robots").some(value => value.includes("noindex")));
console.log("PASS missing and invalid pages: not indexed, real 404 for missing route");

const sitemap = await read("/sitemap.xml");
assert.equal(sitemap.response.status, 200);
const urls = [...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.deepEqual(urls, publicPaths.map(path => new URL(path, canonicalOrigin).href));
const robots = await read("/robots.txt");
assert.equal(robots.response.status, 200);
assert.match(robots.html, /Allow: \/\s/);
assert.match(robots.html, /Sitemap: https:\/\/www\.apogee\.community\/sitemap\.xml/);
console.log("PASS sitemap and robots: public canonical pages are discoverable");
