import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const cssModule = { default: new Proxy({}, { get: (_, key) => String(key) }) };

// Use the real React server renderer and component source. Only bundler-owned
// CSS and Next routing are substituted; these tests do not simulate a browser.
async function loadComponent(path, dependencies = {}) {
  const source = await readSource(path);
  const { outputText } = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const imports = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "@/lib/utils": { cn: (...classes) => classes.filter(Boolean).join(" ") },
    ...dependencies,
  };
  const exports = {};
  new Function("require", "exports", outputText)((specifier) => {
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected ${path} import: ${specifier}`);
    return imports[specifier];
  }, exports);
  return exports;
}

const cardModule = await loadComponent("components/ui/card-7.tsx", {
  "./card-7.module.css": cssModule,
});
const { InteractiveProductCard } = cardModule;
const baseProps = { title: "Caderno orbital", description: "Papelaria · A5" };
const renderCard = (props = {}) => renderToStaticMarkup(React.createElement(InteractiveProductCard, { ...baseProps, ...props }));

test("product card server-renders its image, logo, title, description and price without browser APIs", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
  const html = renderCard({
    imageUrl: "/products/caderno.jpg",
    logoUrl: "/brand/apogee-logo-navy.svg",
    price: "R$ 149",
    className: "custom-card",
    "data-example": "catalog",
  });

  assert.match(html, /<h3>Caderno orbital<\/h3>/);
  assert.match(html, /<p\b[^>]*>Papelaria · A5<\/p>/);
  assert.match(html, /<img\b[^>]*src="\/products\/caderno\.jpg"/);
  assert.match(html, /<img\b[^>]*src="\/brand\/apogee-logo-navy\.svg"/);
  assert.match(html, /data-card-badge="true">R\$ 149<\/div>/);
  assert.match(html, /class="[^"]*custom-card[^"]*"/);
  assert.match(html, /data-example="catalog"/);
  assert.equal((html.match(/data-active="(?:true|false)"/g) ?? []).length, 4);
  assert.equal((html.match(/data-active="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<button\b|role="button"/);
});

test("custom illustration, brand, prototype badge and footer replace demo-specific content", () => {
  const html = renderCard({
    visual: React.createElement("svg", { "data-test-visual": "original", viewBox: "0 0 20 20" }),
    brand: React.createElement("span", null, "Apogee"),
    logoUrl: "/unused-demo-logo.svg",
    badge: React.createElement("strong", null, "Protótipo"),
    price: "R$ 999",
    footer: React.createElement("span", null, "Toda trajetória começa no papel."),
    showIndicators: false,
    children: React.createElement("small", null, "Coleção em desenvolvimento"),
  });

  assert.match(html, /data-card-artwork="true"[^>]*aria-hidden="true"/);
  assert.match(html, /data-test-visual="original"/);
  assert.match(html, /Apogee/);
  assert.match(html, /data-card-badge="true"><strong>Protótipo<\/strong>/);
  assert.match(html, /data-card-footer="true"><span>Toda trajetória começa no papel\.<\/span>/);
  assert.match(html, /Coleção em desenvolvimento/);
  assert.doesNotMatch(html, /unused-demo-logo|R\$ 999|class="indicators"|data-active=/);
});

test("an activatable card exposes one native dialog button with its accessible name and description", () => {
  const html = renderCard({ onActivate() {}, actionLabel: "Ver protótipo Caderno orbital" });
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 1);
  assert.match(buttons[0], /type="button"/);
  assert.match(buttons[0], /data-card-action="true"/);
  assert.match(buttons[0], /aria-label="Ver protótipo Caderno orbital"/);
  assert.match(buttons[0], /aria-haspopup="dialog"/);
  const descriptionId = buttons[0].match(/aria-describedby="([^"]+)"/)?.[1];
  assert.ok(descriptionId, "the button references the visible product description");
  assert.ok(html.includes(`<p id="${descriptionId}">Papelaria · A5</p>`));
  assert.doesNotMatch(html, /role="button"|tabindex=/);
});

test("the action name defaults to the title and supports a non-dialog action", () => {
  const html = renderCard({ onActivate() {}, actionHasPopup: false });
  assert.match(html, /<button\b[^>]*aria-label="Caderno orbital"/);
  assert.match(html, /<button\b[^>]*aria-haspopup="false"/);
});

test("the layout wrapper does not emulate click or keyboard button semantics", async () => {
  const source = await readSource("components/ui/card-7.tsx");
  const file = ts.createSourceFile("card-7.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let wrapper;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node)
      && node.tagName.getText(file) === "div"
      && node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.getText(file) === "ref"
        && attribute.initializer?.getText(file) === "{cardRef}")) wrapper = node;
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(wrapper, "the outer card wrapper remains identifiable");
  const attributes = wrapper.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => attribute.name.getText(file));
  for (const syntheticControl of ["onClick", "onKeyDown", "onKeyUp", "role", "tabIndex"]) {
    assert.ok(!attributes.includes(syntheticControl), `the wrapper must not supply ${syntheticControl}`);
  }
});

test("standalone and page-managed motion policies remain explicit in server markup", () => {
  assert.match(renderCard(), /data-card-motion="system"/);
  assert.match(renderCard(), /data-motion-managed="false"/);
  assert.match(renderCard({ motionEnabled: false }), /data-card-motion="disabled"/);
  const managed = renderCard({ motionEnabled: true, motionManaged: true });
  assert.match(managed, /data-card-motion="enabled"/);
  assert.match(managed, /data-motion-managed="true"/);
});

test("the actual store renders six straight prototype cards instead of importing the Nike demo", async () => {
  const { StoreExperience } = await loadComponent("app/loja/store-experience.tsx", {
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "./loja.module.css": cssModule,
    "./store-orb": { StoreOrb: () => null },
    "./store-product-visual": { StoreProductVisual: ({ kind }) => React.createElement("svg", { "data-store-visual": kind }) },
    "@/components/ui/card-7": cardModule,
    // The hero's navigation/category contract is covered separately. This
    // focused card test keeps its supplied background, controls and CTA.
    "@/components/ui/commerce-hero": {
      CommerceHero: ({ background, headerActions, children }) => React.createElement("section", null, background, headerActions, children),
    },
  });
  const html = renderToStaticMarkup(React.createElement(StoreExperience));
  assert.equal((html.match(/data-store-card="true"/g) ?? []).length, 6);
  assert.equal((html.match(/data-motion-managed="false"/g) ?? []).length, 6);
  assert.equal((html.match(/data-card-motion="disabled"/g) ?? []).length, 6);
  assert.equal((html.match(/data-card-badge="true">Protótipo<\/div>/g) ?? []).length, 6);
  assert.equal((html.match(/aria-label="Ver protótipo [^"]+"/g) ?? []).length, 6);
  assert.equal((html.match(/data-store-visual=/g) ?? []).length, 6);
  assert.doesNotMatch(html, /Nike|M2K|\$149|cdn\.21st\.dev|class="indicators"/i);
  assert.match(html, /A loja está em preparação/);
  assert.doesNotMatch(html, /comprar agora|adicionar ao carrinho|checkout/i);
});
