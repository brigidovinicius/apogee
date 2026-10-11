import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
async function load(path, mocks = {}) {
  const output = ts.transpileModule(await source(path), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => {
    if (specifier in mocks) return mocks[specifier];
    return require(specifier);
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const notFound = () => { throw new Error("NOT_FOUND"); };
async function galleryRoute(listCommunityPhotos) {
  return load("app/galeria/page.tsx", {
    "next/navigation": { notFound },
    "@/components/gallery/gallery-experience": { GalleryExperience: () => null },
    "@/lib/gallery": { listCommunityPhotos },
    "@/lib/gallery-pagination": await load("lib/gallery-pagination.ts"),
  });
}

test("gallery pages have their own canonical URL and server-rendered public data", async () => {
  const calls = [];
  const route = await galleryRoute(async (request, options) => {
    calls.push({ offset: new URL(request.url).searchParams.get("offset"), options });
    return Response.json({ photos: [{ id: "public-photo" }], nextOffset: 48 });
  });
  const params = { searchParams: Promise.resolve({ pagina: "2" }) };
  const metadata = await route.generateMetadata(params);
  assert.equal(metadata.alternates.canonical, "/galeria?pagina=2");
  assert.equal(metadata.openGraph.url, "/galeria?pagina=2");
  assert.match(metadata.title, /página 2/);
  const result = await route.default(params);
  assert.deepEqual(result.props.initialPage, { photos: [{ id: "public-photo" }], nextOffset: 48 });
  assert.equal(result.props.initialOffset, 24);
  assert.equal(result.key, "2");
  assert.deepEqual(calls, [{ offset: "24", options: { cleanupRetired: false } }]);
  const first = await route.generateMetadata({ searchParams: Promise.resolve({}) });
  assert.equal(first.alternates.canonical, "/galeria");
});

test("invalid and empty gallery pages return notFound without reading invalid offsets", async () => {
  let calls = 0;
  const route = await galleryRoute(async () => { calls++; return Response.json({ photos: [], nextOffset: null }); });
  for (const pagina of ["0", "-1", "1.5", "418", "01", "1<script>", ["1", "2"]]) {
    await assert.rejects(route.default({ searchParams: Promise.resolve({ pagina }) }), /NOT_FOUND/);
  }
  assert.equal(calls, 0);
  await assert.rejects(route.default({ searchParams: Promise.resolve({ pagina: "2" }) }), /NOT_FOUND/);
  assert.equal(calls, 1);
});

test("a storage outage keeps the real gallery introduction available with a client retry", async () => {
  const route = await galleryRoute(async () => Response.json({ error: "unavailable" }, { status: 503 }));
  const result = await route.default({ searchParams: Promise.resolve({}) });
  assert.equal(result.props.initialPage, undefined);
  assert.equal(result.props.initialOffset, 0);
});

test("gallery HTML contains real image dimensions, alt text and crawlable next/previous links", async () => {
  const { PhotoGrid } = await load("components/gallery/photo-grid.tsx", {
    "next/link": { __esModule: true, default: ({ children, ...props }) => createElement("a", props, children) },
    "./gallery.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  });
  const html = renderToStaticMarkup(createElement(PhotoGrid, {
    photos: [{ id: "one", src: "/public-photo.webp", author: "Anônimo", anonymous: true, instagram: "", width: 900, height: 1600 }],
    loading: false, error: false, hasMore: true, loadingMore: false, onLoadMore: () => {},
    previousPageHref: "/galeria", nextPageHref: "/galeria?pagina=3",
  }));
  assert.match(html, /width="900" height="1600"/);
  assert.match(html, /alt="Foto do evento Make It Fly enviada anonimamente"/);
  assert.match(html, /href="\/galeria\?pagina=3"/);
  assert.match(html, /href="\/galeria"/);
  assert.doesNotMatch(html, /<button/);
});

test("home structured data identifies the actual website and organization without invented offers", async () => {
  const home = await load("app/page.tsx", { "@/components/home/apogee-home": { ApogeeHome: () => createElement("main", {}, "Apogee") } });
  const html = renderToStaticMarkup(createElement(home.default));
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(data["@context"], "https://schema.org");
  assert.deepEqual(data["@graph"].map(item => item["@type"]), ["WebSite", "Organization"]);
  assert.equal(data["@graph"][0].url, "https://www.apogee.community/");
  assert.equal(data["@graph"][0].name, "Apogee");
  assert.equal(data["@graph"][1].name, "Apogee");
  assert.doesNotMatch(JSON.stringify(data), /Product|Offer|Event|rating|review|price|startDate/);
});

test("API responses are noindex while robots and sitemap remain crawlable", async () => {
  const config = (await load("next.config.ts")).default;
  const rules = await config.headers();
  assert.deepEqual(rules.find(rule => rule.source === "/api/:path*").headers,
    [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]);
  const robots = (await load("app/robots.ts")).default();
  const sitemap = (await load("app/sitemap.ts")).default();
  assert.equal(robots.rules.allow, "/");
  assert.equal(robots.sitemap, "https://www.apogee.community/sitemap.xml");
  assert.deepEqual(sitemap.map(entry => new URL(entry.url).pathname), ["/", "/oportunidades", "/galeria", "/loja", "/makeitfly"]);
  assert.ok(sitemap.every(entry => !entry.lastModified));
});
