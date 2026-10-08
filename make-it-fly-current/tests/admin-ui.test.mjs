import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("the four prototype-backed admin surfaces and route states exist", async () => {
  for (const path of [
    "app/admin/page.tsx",
    "app/admin/usuarios/page.tsx",
    "app/admin/curadoria/page.tsx",
    "app/admin/posts/novo/page.tsx",
    "app/admin/acesso-negado/page.tsx",
    "app/admin/loading.tsx",
    "app/admin/error.tsx",
    "docs/admin-ui-inventory.md",
  ]) {
    assert.equal(existsSync(new URL(path, root)), true, path);
  }

  const layout = await source("app/admin/layout.tsx");
  assert.match(layout, /robots: \{ index: false, follow: false, noarchive: true \}/);
  assert.match(layout, /<AdminShell showModeSwitcher=/);
});

test("admin UI includes accessible loading, error, empty and denied states", async () => {
  const [loading, error, users, curation, denied] = await Promise.all([
    source("app/admin/loading.tsx"),
    source("app/admin/error.tsx"),
    source("app/admin/usuarios/page.tsx"),
    source("app/admin/curadoria/page.tsx"),
    source("app/admin/acesso-negado/page.tsx"),
  ]);

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /onClick=\{retry\}/);
  assert.match(users, /role="status"/);
  assert.match(curation, /role="status"/);
  assert.match(denied, /role="alert"/);
});

test("admin navigation and records remain keyboard and mobile friendly", async () => {
  const [nav, users, css] = await Promise.all([
    source("components/admin/admin-nav.tsx"),
    source("app/admin/usuarios/page.tsx"),
    source("components/admin/admin.module.css"),
  ]);

  assert.match(nav, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(users, /<details/);
  assert.match(users, /<summary>/);
  assert.match(users, /role="search"/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /min-height: var\(--apogee-control-min-height\)/);
});

test("inventory records prototype gaps instead of inventing product rules", async () => {
  const inventory = await source("docs/admin-ui-inventory.md");
  assert.match(inventory, /A1.*Painel/s);
  assert.match(inventory, /A2.*Criação de post/s);
  assert.match(inventory, /A3.*Lista, busca/s);
  assert.match(inventory, /A4.*Curadoria/s);
  assert.match(inventory, /não foram tratados como dados ou regras\s+aprovadas/);
  assert.match(inventory, /Não foram criadas ações de exportar, suspender, atribuir papel, publicar/);
});
