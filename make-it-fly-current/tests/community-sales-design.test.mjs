import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function render(props = {}) {
  const load = opportunityLoader({
    "next/image": { __esModule: true, default: ({ preload, ...props }) => { void preload; return React.createElement("img", props); } },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
    "@/lib/billing/community-config": { communityBillingEnabled: () => false },
  });
  return renderToStaticMarkup(React.createElement(load("components/community/community-sales-page.tsx").CommunitySalesPage, props));
}

test("sales page retains the complete offer and honest delivery states with working section links", () => {
  const html = render();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  for (const text of ["Caixa de Ferramentas", "Benefícios", "Trilha de IA aplicada", "Google Flow", "R$ 1.438,80", "R$ 119,90", "10 eventos distintos", "direitos são preservados", "inicialmente de forma parcial", "ainda está em preparação", "independente da assinatura"]) assert.ok(html.includes(text), text);
  for (const id of ["comunidade", "radar", "ferramentas", "learn", "perks", "planos", "participar", "duvidas"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `broken section link: ${id}`);
  assert.match(html, /href="\/evento-openai"/);
  assert.doesNotMatch(html, /href="\/membros\/ferramentas"|href="\/membros\/assinatura"/);
  assert.match(html, /A contratação anual será disponibilizada após a validação/);
});

test("sales layout preserves the preview and safe return-destination contract", () => {
  const destination = "/membros/oportunidades/um-evento";
  assert.ok(render({ next: destination }).includes(`/membros/cadastro?next=${encodeURIComponent(destination)}`));
  const preview = render({ preview: true, next: destination });
  assert.match(preview, /href="\/previa\/entrada"/);
  assert.doesNotMatch(preview, /href="\/membros\/cadastro/);
});
