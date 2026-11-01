import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { interfaceText } from "../lib/presentation-text.mjs";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const require = createRequire(import.meta.url);
async function load(path, mocks = {}) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", code)((id) => id in mocks ? mocks[id] : require(id), loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const helpers = await load("lib/home-opportunities.ts");
const { opportunityDetailPath } = await load("lib/opportunities/detail-path.ts");
const { EarthRadarList } = await load("components/home/earth-radar/earth-radar-list.tsx", {
  "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return createElement("a", props, children); } },
  "@/lib/home-opportunities": helpers,
  "@/lib/opportunities/detail-path": { opportunityDetailPath },
  "@/lib/presentation-text.mjs": { interfaceText },
  "@/components/opportunities/opportunity-financials": opportunityLoader()("components/opportunities/opportunity-financials.tsx"),
  "@/components/opportunities/opportunity-dates": opportunityLoader()("components/opportunities/opportunity-dates.tsx"),
  "./earth-radar.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
});

test("homepage displays confirmed prize conditions without treating attendance or unverified prose as a prize", () => {
  const prize = { ...item, financials: { benefits: [{ label: "PREMIAÇÃO TOTAL", text: "R$ 5000 distribuídos entre as equipes vencedoras" }], costs: [], notes: [] } };
  const html = renderToStaticMarkup(createElement(EarthRadarList, { capturedAt, opportunities: [prize] }));
  assert.match(html, /PREMIAÇÃO TOTAL/);
  assert.match(html, /5\.000,00/);
  assert.match(html, /equipes vencedoras/);
  const attendance = renderToStaticMarkup(createElement(EarthRadarList, { capturedAt, opportunities: [{ ...item, benefit: "Cerimônia de premiação" }] }));
  assert.doesNotMatch(attendance, /PREMIAÇÃO/);
});
const capturedAt = "2026-10-24T15:00:00.000Z";
const item = { id: "verified-fixture", title: "Oportunidade da fonte", organization: "Organização", kind: "Programa", location: "Brasil", deadline: "2026-10-25", deadlineLabel: "25 de outubro", categories: ["eventos"] };

test("Earth homepage renders real catalogue fields, excludes expired items and links through existing access routes", () => {
  const html = renderToStaticMarkup(createElement(EarthRadarList, { capturedAt, opportunities: [item, { ...item, id: "expired", title: "Expired fixture", deadline: "2026-10-23" }] }));
  assert.match(html, /Oportunidade da fonte/);
  assert.match(html, /25 de outubro/);
  assert.ok(html.includes(`href="${opportunityDetailPath(item.id)}"`));
  assert.match(html, /name="busca"/);
  assert.match(html, /action="\/oportunidades"/);
  assert.doesNotMatch(html, /Expired fixture|Conteúdo de demonstração|Salvar:/);
});

test("Earth homepage has an honest empty state instead of demonstration opportunities", () => {
  const html = renderToStaticMarkup(createElement(EarthRadarList, { capturedAt, opportunities: [] }));
  assert.match(html, /Nenhuma oportunidade em destaque/);
  assert.match(html, /Ver o Radar completo/);
  assert.doesNotMatch(html, /Oportunidade da fonte|exemplos do protótipo/);
});

test("public catalogue outages keep the catalogue link without inventing entries", async () => {
  const { HomeRadar } = await load("components/home/home-radar.tsx", {
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return createElement("a", props, children); } },
    "@/lib/opportunities/access": { listPublicOpportunities: async () => { throw new Error("offline"); } },
    "@/lib/home-opportunities": helpers,
    "./earth-radar/earth-radar-list": { EarthRadarList },
    "./home-radar-list": { HomeRadarList: () => null },
    "./editorial-home.module.css": { __esModule: true, default: {} },
  });
  const html = renderToStaticMarkup(await HomeRadar({ presentation: "earth" }));
  assert.match(html, /temporariamente indisponível/);
  assert.match(html, /href="\/oportunidades"/);
});


test("both opening Radar calls to action navigate to the opportunities catalogue", async () => {
  const { SiteHeader } = await load("components/site/site-header.tsx", {
    "./site-mobile-navigation": { SiteMobileNavigation: () => null },
    "./site-shell.module.css": { __esModule: true, default: {} },
  });
  const { createScrollProgress } = await load("components/home/earth-radar/scroll-progress.ts");
  const { EarthRadarPreview } = await load("components/home/earth-radar/earth-radar-preview.tsx", {
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return createElement("a", props, children); } },
    "./scroll-progress": { createScrollProgress },
    "@/components/site/site-header": { SiteHeader },
    "@/components/site/site-footer": { SiteFooter: () => null },
    "./earth-radar-scene": { EarthRadarScene: () => null },
    "./earth-signature": { EarthSignature: () => null },
    "./earth-radar.module.css": { __esModule: true, default: {} },
  });
  const html = renderToStaticMarkup(createElement(EarthRadarPreview, { radar: null }));
  assert.match(html, /href="\/oportunidades">Oportunidades<\/a>/);
  assert.match(html, /href="\/oportunidades">Explorar o Radar<\/a>/);
  assert.doesNotMatch(html, /href="#radar"/);
});

test("mobile signature and video failures keep an animated fallback covering both the lettering and star", async () => {
  for (const [mode, failed, state, expected, video] of [
    ["lightweight", false, "loading", "shimmer", false],
    ["video", false, "blocked", "shimmer", true],
    ["video", true, "loading", "shimmer", false],
    ["static", false, "loading", "static", false],
    ["video", false, "playing", "playing", true],
  ]) {
    const { EarthSignature } = await load("components/home/earth-radar/earth-signature.tsx", {
      react: { ...require("react"), useSyncExternalStore: () => mode,
        useState: (initial) => [typeof initial === "boolean" ? failed : state, () => {}] },
      "./media-playback": {},
      "./earth-radar.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
    });
    const html = renderToStaticMarkup(createElement(EarthSignature));
    assert.ok(html.includes(`data-signature-state="${expected}"`));
    assert.equal(html.includes("<video"), video);
    assert.match(html, /<mask[^>]*height="940"[^>]*mask-type:luminance/);
    assert.match(html, /<image href="[^"]*signature-gpt.webp" width="1672" height="940"/);
    assert.match(html, /<g mask="url\(#[^"]+\)"><rect[^>]+height="940"/);
  }
});
