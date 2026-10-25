import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { interfaceText } from "../lib/presentation-text.mjs";

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
  "./earth-radar.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
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
