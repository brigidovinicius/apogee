import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

function render(props = {}, enabled = false) {
  const load = opportunityLoader({
    "next/image": { __esModule: true, default: ({ preload, ...props }) => { void preload; return React.createElement("img", props); } },
    "next/link": { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } },
    "@/lib/billing/community-config": { communityBillingEnabled: () => enabled },
  });
  return renderToStaticMarkup(React.createElement(load("components/community/community-sales-page.tsx").CommunitySalesPage, { resources: { ferramentas: true }, ...props }));
}

test("sales page retains the complete offer and honest delivery states with working section links", () => {
  const html = render();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  for (const text of ["Caixa de Ferramentas", "Benefícios", "R$ 1.438,80", "R$ 119,90", "10 consultas mensais no Radar e 10 em Benefícios", "Os acessos anteriores ao Radar continuam válidos", "depende das condições e da elegibilidade de cada oferta", "independente da assinatura"]) assert.ok(html.includes(text), text);
  for (const id of ["comunidade", "radar", "ferramentas", "perks", "planos", "participar", "duvidas"]) assert.ok(html.includes(`id="${id}"`), id);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${id}"`), `broken section link: ${id}`);
  assert.match(html, /href="\/evento-openai#workshop-florianopolis"/);
  assert.match(html, /href="\/galeria"[^>]*>Ver fotos do Make It Fly/);
  assert.doesNotMatch(html, /href="\/makeitfly"/);
  assert.match(html, /href="\/evento-openai"/);
  assert.doesNotMatch(html, /href="\/membros\/ferramentas"|href="\/membros\/assinatura"/);
  assert.match(html, /A contratação anual está temporariamente indisponível/);
  assert.doesNotMatch(html, /Ver o que está incluído|10 consultas mensais na conta gratuita|consultas gratuitas por mês|Explore o catálogo sem usar a sua cota/);
});

test("sales layout preserves the preview and safe return-destination contract", () => {
  assert.ok(render().includes('href="/membros/cadastro?next=%2Fmembros"'));
  const destination = "/membros/oportunidades/um-evento";
  assert.ok(render({ next: destination }).includes(`/membros/cadastro?next=${encodeURIComponent(destination)}`));
  assert.match(render(), /href="\/membros\/entrar\?next=%2Fmembros">Continuar com minha conta/);
  assert.ok(render({ next: destination }).includes(`href="/membros/entrar?next=${encodeURIComponent(destination)}">Continuar com minha conta`));
  assert.ok(render({ next: destination, signedIn: true }).includes(`href="${destination}">Continuar com minha conta`));
  const preview = render({ preview: true, next: destination });
  assert.match(preview, /href="\/previa\/entrada"/);
  assert.doesNotMatch(preview, /href="\/membros\/cadastro/);
});


test("annual sales link is enabled only by the commercial switch and never by preview", () => {
  const next = "/membros/ferramentas?categoria=video";
  const active = render({ next }, true);
  assert.ok(active.includes(`href="/membros/assinatura?next=${encodeURIComponent(next)}"`));
  const signedIn = render({ next, signedIn: true }, true);
  assert.ok(signedIn.includes(`action="/api/comunidade/assinatura/checkout?next=${encodeURIComponent(next)}"`));
  assert.match(signedIn, /method="post"/);
  assert.match(active, /Assinar agora/);
  assert.match(active, /R\$ 1\.438,80/);
  assert.match(active, /Pagamento integral anual/);
  assert.match(active, /Renovação automática/);
  assert.doesNotMatch(active, /O catálogo ainda está em preparação|valor proposto|serão apresentados antes da adesão/);
  const preview = render({ preview: true, next }, true);
  assert.doesNotMatch(preview, /action="\/api\/comunidade\/assinatura/);
  assert.match(preview, /aria-disabled="true"/);
});

test("benefits availability reflects the real catalogue without promising eligibility", () => {
  assert.match(render({ hasBenefits: true }), /Há ofertas vigentes no catálogo/);
  assert.match(render({ hasBenefits: false }), /O catálogo está sem ofertas vigentes no momento/);
  assert.doesNotMatch(render({ hasBenefits: null }), /Há ofertas vigentes|está sem ofertas vigentes/);
  assert.match(render({ hasBenefits: true }), /elegibilidade de cada oferta/);
});

test("the learning track is absent from the public offer and local preview", () => {
  for (const props of [{}, { preview: true }, { signedIn: true }, { signedIn: true, subscribed: true }]) {
    assert.doesNotMatch(render(props, true), /trilha|#learn|id="learn"|primeiro resultado com IA/i);
  }
});

test("the toolbox is absent from the offer when it has no published content", () => {
  const html = render({ resources: { ferramentas: false } });
  assert.doesNotMatch(html, /href="#ferramentas"|id="ferramentas"/);
  assert.match(html, /10 consultas mensais no Radar e 10 em Benefícios/);
});
