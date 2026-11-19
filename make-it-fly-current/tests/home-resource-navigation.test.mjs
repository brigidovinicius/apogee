import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { parse } = createRequire(import.meta.url)("next/dist/compiled/node-html-parser");
const resources = [
  ["Meu Radar", "/membros/oportunidades"],
  ["Benefícios", "/membros/beneficios"],
  ["Caixa de ferramentas", "/membros/ferramentas"],
  ["Skills", "/membros/ferramentas?categoria=skills"],
  ["Trilha de aprendizagem", "/membros/trilha"],
];
const load = opportunityLoader({
  "next/navigation": { usePathname: () => "/", useRouter: () => ({}) },
  "@/app/membros/actions": { signOut: () => {} },
});
const { SiteHeader } = load("components/site/site-header.tsx");
const { AccountProvider } = load("components/members/account-menu.tsx");
const { McpAvailabilityProvider } = load("components/site/mcp-connect-link.tsx");

function renderHeader(account) {
  return parse(renderToStaticMarkup(createElement(AccountProvider, { account },
    createElement(McpAvailabilityProvider, { enabled: true },
      createElement(SiteHeader, { current: "home", tone: "light", adaptive: true, prefetch: false, showMemberResources: true })))));
}

for (const [role, account] of [["visitante", null], ["membro", { role: "member", username: "teste", name: "Teste" }]]) {
  test(`home expõe o mesmo destino para cada recurso no desktop e no celular para ${role}`, () => {
    const html = renderHeader(account);
    const desktop = html.querySelector('nav[aria-label="Recursos da área de membros"]');
    const mobile = html.querySelector('nav[aria-label="Navegação móvel"]');
    const group = mobile.querySelector('[role="group"][aria-label="Área de membros"]');
    for (const panel of [desktop, group]) {
      assert.deepEqual(panel.querySelectorAll("a").map(link => [link.text, link.getAttribute("href")]), resources);
    }
    for (const name of ["Área de membros", "Mais seções", "Abrir navegação"]) {
      const control = html.querySelector(`summary[aria-label="${name}"]`);
      const panel = control.parentNode.querySelector("nav");
      assert.equal(control.getAttribute("aria-controls"), panel.getAttribute("id"));
    }
    for (const path of ["/comunidade", "/oportunidades", "/blog", "/loja", "/galeria", "/evento-openai", "/membros/integracoes/mcp#claude"]) {
      assert.ok(mobile.querySelector(`a[href="${path}"]`), path);
    }
    if (account) assert.ok(html.querySelector('nav[aria-label="Minha conta"]'));
    else assert.equal(html.querySelector('a[href="/membros"]').text, "Entrar");
  });
}

test("a rota pública da home ativa o novo menu", () => {
  const source = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source("app/page.tsx"), /<EditorialHome\s*\/>/);
  assert.match(source("components/home/editorial-home.tsx"), /<SiteHeader\b[^>]*\bshowMemberResources\b/);
});
