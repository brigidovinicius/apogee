import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const readSource = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const cssModule = { default: new Proxy({}, { get: (_, key) => String(key) }) };

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
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    ...dependencies,
  };
  const exports = {};
  new Function("require", "exports", outputText)((specifier) => {
    if (Object.hasOwn(imports, specifier)) return imports[specifier];
    if (specifier.endsWith(".module.css")) return cssModule;
    if (["framer-motion", "lucide-react", "@radix-ui/react-slot", "class-variance-authority"].includes(specifier)) return require(specifier);
    throw new Error(`Unexpected ${path} import: ${specifier}`);
  }, exports);
  return exports;
}

const buttonModule = await loadComponent("components/ui/button.tsx");
const brandModule = await loadComponent("components/ui/brand-mark.tsx");
const commerceModule = await loadComponent("components/ui/commerce-hero.tsx", {
  "@/components/ui/button": buttonModule,
  "@/components/ui/brand-mark": brandModule,
});
const { CommerceHero } = commerceModule;
const renderHero = (props = {}) => renderToStaticMarkup(React.createElement(CommerceHero, props));

test("commerce hero server-renders one accessible heading without browser APIs or demo copy", () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");
  const html = renderHero({
    id: "colecao-teste",
    headingId: "titulo-teste",
    title: React.createElement("span", null, "Objetos que ganham o mundo"),
    description: "Estudos da primeira coleção.",
    motionEnabled: false,
  });
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1\b[^>]*id="titulo-teste"/);
  assert.match(html, /aria-labelledby="titulo-teste"/);
  assert.match(html, /id="colecao-teste"/);
  assert.match(html, /Objetos que ganham o mundo/);
  assert.match(html, /Estudos da primeira coleção\./);
  assert.doesNotMatch(html, /Curate your products|Commerce_|Log In|ShoppingBasket|href="#"/);
});

test("default navigation uses working site routes instead of button-only placeholders", () => {
  const html = renderHero();
  assert.match(html, /aria-label="Apogee - início"/);
  const nav = html.match(/<nav\b[^>]*aria-label="Navegação da loja"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, "the hero exposes a named navigation landmark");
  assert.match(nav, /<a\b[^>]*href="\/"[^>]*>Início<\/a>/);
  assert.match(nav, /<a\b[^>]*href="#produtos"[^>]*>Coleção<\/a>/);
  assert.match(nav, /<a\b[^>]*href="\/galeria"[^>]*>Nossa história<\/a>/);
  assert.doesNotMatch(nav, /<button\b|href="#"/);
});

test("custom category links retain titles, descriptions and original visual slots", () => {
  const categories = [
    { title: "Vestuário", description: "Para vestir uma ideia", href: "#produto-uniforme", visual: React.createElement("svg", { "data-category-art": "wearable" }) },
    { title: "Objetos", description: "Uma outra dimensão", href: "#produto-apogeu", visual: React.createElement("svg", { "data-category-art": "object" }) },
  ];
  const html = renderHero({ categories, motionEnabled: false });
  assert.match(html, /aria-label="Categorias da coleção"/);
  for (const category of categories) {
    assert.ok(html.includes(`href="${category.href}"`));
    assert.ok(html.includes(category.title));
    assert.ok(html.includes(category.description));
  }
  assert.equal((html.match(/data-category-art=/g) ?? []).length, 2);
  assert.doesNotMatch(html, /cdn\.21st\.dev|Footwear|Technology|Accessories|href="#"/);
});

test("brand, background, actions and CTA stay composable without adding fake commerce controls", () => {
  const html = renderHero({
    brand: React.createElement("span", null, "Marca da comunidade"),
    brandHref: "/galeria",
    background: React.createElement("div", { "data-custom-orb": "true" }),
    headerActions: React.createElement("button", { type: "button" }, "Em breve"),
    children: React.createElement("a", { href: "#produtos" }, "Ver a coleção"),
    className: "custom-commerce",
    "data-test-section": "custom",
  });
  assert.match(html, /Marca da comunidade/);
  assert.match(html, /data-custom-orb="true"/);
  assert.match(html, /<button\b[^>]*>Em breve<\/button>/);
  assert.match(html, /<a\b[^>]*href="#produtos"[^>]*>Ver a coleção<\/a>/);
  assert.match(html, /custom-commerce/);
  assert.match(html, /data-test-section="custom"/);
  assert.doesNotMatch(html, /aria-label="Abrir menu"|Search|Cart|Log In|href="#"/);
});

test("the optional mobile trigger is a named native button tied to the existing dialog", () => {
  for (const menuOpen of [false, true]) {
    const html = renderHero({ onMenuRequest() {}, menuOpen, menuControls: "custom-store-menu" });
    const button = (html.match(/<button\b[^>]*>/g) ?? []).find((tag) => tag.includes('aria-label="Abrir menu"'));
    assert.ok(button, "the menu control has an accessible Portuguese label");
    assert.match(button, /type="button"/);
    assert.match(button, /aria-haspopup="dialog"/);
    assert.match(button, /aria-controls="custom-store-menu"/);
    assert.ok(button.includes(`aria-expanded="${menuOpen}"`));
  }
});

test("motion follows the system by default and explicit pause leaves server content visible", () => {
  const system = renderHero();
  const paused = renderHero({ motionEnabled: false });
  const animated = renderHero({ motionEnabled: true });
  assert.match(system, /data-commerce-motion="reduced"/);
  assert.match(paused, /data-commerce-motion="reduced"/);
  assert.match(animated, /data-commerce-motion="full"/);
  for (const html of [system, paused]) {
    assert.doesNotMatch(html, /opacity:0(?:;|")/);
    assert.doesNotMatch(html, /translateY\(20px\)/);
  }
  assert.doesNotMatch(`${system}${paused}${animated}`, /motionEnabled=|onMenuRequest=/);
});

test("the store shows three real products and reveals signup only after buying intent", async () => {
  const { opportunityLoader } = await import("./helpers/load-opportunity-module.mjs");
  const load = opportunityLoader({
    "next/image": { __esModule: true, default: ({ preload, ...props }) => { void preload; return React.createElement("img", props); } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/components/site/site-header": { SiteHeader: () => React.createElement("header", null, "Apogee") },
  });
  const { StoreExperience } = load("app/loja/store-experience.tsx");
  const { products } = load("lib/store/products.ts");
  const html = renderToStaticMarkup(React.createElement(StoreExperience));
  assert.equal(products.length, 3);
  assert.deepEqual(products.map(item => item.photos.length), [2, 3, 2]);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.equal((html.match(/<article\b/g) ?? []).length, 3);
  for (const product of products) {
    assert.ok(html.includes(product.name));
    for (const photo of product.photos) {
      assert.ok(html.includes(photo.src));
      const { access } = await import("node:fs/promises");
      await access(new URL(`../public${photo.src}`, import.meta.url));
    }
  }
  assert.equal((html.match(/aria-label="Comprar /g) ?? []).length, 3);
  assert.doesNotMatch(html, /<form|Quero receber novidades|href="#novos-drops"/);
  assert.match(html, /<dialog[^>]*id="drop-purchase-dialog"/);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`));
  assert.match(html, /<dialog/);
  assert.doesNotMatch(html, /carrinho|checkout|comprar agora|R\$|Protótipo|caderno orbital/i);
});
