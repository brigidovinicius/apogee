import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { toolBrand } = opportunityLoader()("lib/toolbox/brands.ts");
const catalogue = JSON.parse(readFileSync(new URL("../content/tool-brands.json", import.meta.url), "utf8"));

test("each registered product and alias resolves to its own local artwork", () => {
  const seen = new Set();
  for (const [name, { destinations }] of Object.entries(catalogue)) {
    const primary = toolBrand(name, "https://" + destinations[0]);
    assert.ok(primary, name);
    assert.ok(existsSync(new URL("../public" + primary.image, import.meta.url)), name);
    assert.ok(!seen.has(primary.image), name);
    seen.add(primary.image);
    for (const target of destinations) assert.equal(toolBrand(name, "https://" + target + "/?ref=ficha").image, primary.image);
  }
});

test("hosted projects and other products on a shared domain keep their own identity", () => {
  assert.equal(toolBrand("Google Flow", "https://labs.google/fx/pt/tools/flow").image, "/brand/tools/google-flow.webp");
  assert.equal(toolBrand("Outra ferramenta", "https://www.adobe.com/products/another.html"), undefined);
  assert.equal(toolBrand("Meu projeto", "https://github.com/org/projeto"), undefined);
  assert.equal(toolBrand("Google Flow", "https://example.org/tools/flow"), undefined);
});

test("published domains work without a saved logo and shared project directories stay independent", () => {
  const { productDomain, brandDomain } = opportunityLoader()("lib/brand/domain.ts");
  assert.equal(productDomain("https://www.blender.org/download/?via=apogee"), "blender.org");
  assert.equal(productDomain("https://github.com/org/skill"), null);
  assert.equal(productDomain("https://example.org:8080"), null);
  for (const domain of ["localhost", "127.0.0.1", "a.test", "a.example/path", "a.example?u=x"]) assert.equal(brandDomain(domain), null);
});

test("automatic artwork forwards only a public domain to one fixed service and caches verified PNGs", async t => {
  const { GET } = opportunityLoader()("app/api/marcas/route.ts");
  const signature = new Uint8Array([137,80,78,71,13,10,26,10]);
  const upstream = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url.origin, "https://t0.gstatic.com");
    assert.equal(url.searchParams.get("url"), "http://blender.org");
    assert.equal(options.redirect, "error");
    return new Response(signature, {headers: {"Content-Type":"image/png"}});
  });
  const response = await GET(new Request("https://site.test/api/marcas?site=blender.org"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.match(response.headers.get("cache-control"), /max-age=86400/);
  upstream.mock.mockImplementation(async () => new Response("not an image", {headers: {"Content-Type":"text/html"}}));
  assert.equal((await GET(new Request("https://site.test/api/marcas?site=blender.org"))).status, 404);
  assert.equal((await GET(new Request("https://site.test/api/marcas?site=localhost"))).status, 404);
  assert.equal(upstream.mock.callCount(), 2);
});

test("a new published benefit can use its own source even without a partner brand record", async t => {
  let row = { source_url: "https://blender.org/download/", partner: "Blender" };
  const sql = async (parts, id) => {
    assert.match(parts.join("?"), /member_benefit_is_available/);
    assert.equal(id, "nova-oferta");
    return row ? [row] : [];
  };
  const { GET } = opportunityLoader({ "@/lib/members/db": { getSql: () => sql } })("app/api/marcas/route.ts");
  const upstream = t.mock.method(globalThis, "fetch", async () => new Response(new Uint8Array([137,80,78,71,13,10,26,10]), {headers: {"content-type":"image/png"}}));
  const req = new Request("https://site.test/api/marcas?beneficio=nova-oferta");
  assert.equal((await GET(req)).status, 200);
  row = { ...row, source_url: "https://directory.example.net/vendor/blender" };
  assert.equal((await GET(req)).status, 404);
  row = null;
  assert.equal((await GET(req)).status, 404);
  assert.equal(upstream.mock.callCount(), 1);
});
