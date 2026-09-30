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
const commerceModule = await loadComponent("components/ui/commerce-hero.tsx", {
  "@/components/ui/button": buttonModule,
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
  assert.match(html, /aria-label="Apogee — início"/);
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

test("the store shows all six products on one page without a category area", async () => {
  const { StoreExperience } = await loadComponent("app/loja/store-experience.tsx", {
    "./store-orb": { StoreOrb: ({ motionEnabled }) => React.createElement("div", { "data-test-orb": "true", "data-test-orb-motion": String(motionEnabled) }) },
    "./store-product-visual": { StoreProductVisual: ({ kind }) => React.createElement("svg", { "data-store-visual": kind }) },
    "@/components/ui/card-7": { InteractiveProductCard: ({ title }) => React.createElement("h3", null, title) },
    "@/components/ui/commerce-hero": commerceModule,
  });
  const html = renderToStaticMarkup(React.createElement(StoreExperience));
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /id="store-title"/);
  assert.match(html, /id="colecao"/);
  assert.match(html, /id="produtos"/);
  for (const slug of ["uniforme", "caderno", "apogeu", "poster", "bolsa", "encontro"]) {
    assert.ok(html.includes(`id="produto-${slug}"`), `${slug} has an actual product target`);
  }
  assert.doesNotMatch(html, /aria-label="Categorias da coleção"|data-commerce-category|href="#produto-/);
  assert.match(html, /Itens para quem vai/);
  assert.match(html, /mudar o mundo/);
  assert.match(html, /Para quem tem/);
  assert.match(html, /sede de mudar/);
  assert.match(html, /Apogee Builders Club/);
  assert.doesNotMatch(html, /MakeItFly|Make it fly store/);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
    assert.ok(html.includes(`id="${anchor}"`), `local anchor #${anchor} resolves on the rendered page`);
  }
  assert.match(html, /<dialog\b[^>]*id="store-mobile-menu"/);
  assert.match(html, /aria-controls="store-mobile-menu"/);
  assert.match(html, /data-store-hero=/);
  assert.match(html, /data-store-orb-travel=/);
  assert.match(html, /data-motion="full"/);
  assert.match(html, /data-commerce-motion="full"/);
  assert.match(html, /data-test-orb-motion="true"/);
  assert.doesNotMatch(html, /Ativar animações|Pausar animações|Usar preferência do sistema|store-motion-description|aria-pressed=/);
  assert.doesNotMatch(html, /href="#"|cdn\.21st\.dev|Commerce_|Footwear|Log In|ShoppingBasket/);
});
