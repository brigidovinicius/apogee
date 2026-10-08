import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("a prévia pública filtra somente a DTO segura e anuncia resultados recuperáveis", async () => {
  const [preview, filters, access] = await Promise.all([
    source("components/opportunities/opportunities-preview.tsx"),
    source("components/opportunities/public-opportunities-preview.tsx"),
    source("lib/opportunities/access.ts"),
  ]);

  assert.match(preview, /<PublicOpportunitiesPreview opportunities=\{opportunities\} memberNext=\{memberNext\} \/>/);
  assert.match(filters, /^"use client";/m);
  assert.match(filters, /aria-pressed=\{value === option\}/);
  assert.match(filters, /aria-controls="public-opportunity-results"/);
  assert.match(filters, /aria-live="polite"/);
  assert.match(filters, /Limpar filtros/);
  assert.match(access, /^import "server-only";/m);

  for (const privateField of ["summary", "eligibility", "benefit", "deadline", "officialUrl", "verifiedAt"]) {
    assert.doesNotMatch(filters, new RegExp(`opportunity\\.${privateField}`), privateField);
  }
});

test("a navegação responsiva do membro só expõe os destinos já implementados", async () => {
  const [bar, styles, memberPage, radarPage, profilePage, editPage] = await Promise.all([
    source("components/members/member-bar.tsx"),
    source("components/members/members.module.css"),
    source("app/membros/page.tsx"),
    source("app/membros/oportunidades/page.tsx"),
    source("app/membros/perfil/[username]/page.tsx"),
    source("app/membros/perfil/editar/page.tsx"),
  ]);

  assert.match(bar, /href="\/membros"/);
  assert.match(bar, /href="\/membros\/oportunidades"/);
  assert.match(bar, /Meu perfil/);
  assert.doesNotMatch(bar, /\/membros\/(?:salvos|alertas|onboarding)/);
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 640px\)/);

  for (const page of [memberPage, radarPage, profilePage, editPage]) {
    assert.match(page, /await requireMember\(/);
  }
});

test("a shell integrada usa a API de imagem atual do Next 16", async () => {
  const header = await source("components/site/site-header.tsx");
  assert.match(header, /\bpreload\b/);
  assert.doesNotMatch(header, /\bpriority\b/);
});
