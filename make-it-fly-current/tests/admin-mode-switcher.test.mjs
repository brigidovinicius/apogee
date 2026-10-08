import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("admin mode switch is server-rendered, explicit, and route-based", async () => {
  const [switcher, styles] = await Promise.all([
    source("components/admin/admin-mode-switcher.tsx"),
    source("components/admin/admin-mode-switcher.module.css"),
  ]);

  assert.doesNotMatch(switcher, /["']use client["']/);
  assert.match(switcher, /Modo Administrador/);
  assert.match(switcher, /Pré-visualização de Usuário/);
  assert.match(switcher, /href="\/admin"/);
  assert.match(switcher, /href="\/membros"/);
  assert.match(switcher, /aria-current="page"/);
  assert.match(switcher, /prefetch=\{false\}/);
  assert.doesNotMatch(switcher, /localStorage|sessionStorage|cookies|token|permission|member\.role|role=\{/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /min-height: var\(--apogee-control-min-height\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
});

test("only a server-confirmed admin receives the switch in either shell", async () => {
  const [layout, shell, memberBar] = await Promise.all([
    source("app/admin/layout.tsx"),
    source("components/admin/admin-shell.tsx"),
    source("components/members/member-bar.tsx"),
  ]);

  assert.match(layout, /await getCurrentMember\(\)/);
  assert.match(layout, /showModeSwitcher=\{member\?\.role === "admin"\}/);
  assert.match(shell, /showModeSwitcher \? \(/);
  assert.match(shell, /<AdminModeSwitcher mode="admin" \/>/);
  assert.match(memberBar, /member\.role === "admin" \? <AdminModeSwitcher mode="user" \/> : null/);
  assert.doesNotMatch(memberBar, /role=\{member\.role\}|mode=\{member\.role\}/);
});

test("direct pages, data access, API, and proxy retain server-side authorization", async () => {
  const [access, data, opportunities, page, galleryPage, galleryRoute, proxy] = await Promise.all([
    source("lib/admin/access.ts"),
    source("lib/admin/data.ts"),
    source("lib/opportunities/access.ts"),
    source("app/admin/posts/novo/page.tsx"),
    source("app/gerenciar-galeria/page.tsx"),
    source("app/api/gallery/admin/route.ts"),
    source("proxy.ts"),
  ]);

  assert.match(access, /^import "server-only";/m);
  assert.match(access, /member\.role !== "admin"/);
  assert.match(data, /await requireAdmin\("\/admin"\)/);
  assert.match(data, /await requireAdmin\("\/admin\/usuarios"\)/);
  assert.match(opportunities, /await requireAdmin\("\/admin\/curadoria"\)/);
  assert.match(page, /await requireAdmin\("\/admin\/posts\/novo"\)/);
  assert.match(galleryPage, /await requireAdmin\("\/gerenciar-galeria"\)/);
  assert.match(galleryRoute, /getMemberFromHeaders\(request\.headers\)/);
  assert.match(proxy, /"\/admin", "\/admin\/:path\*"/);
});

test("serialized client boundaries contain navigation only, never admin records or auth state", async () => {
  const [nav, shell, layout, data] = await Promise.all([
    source("components/admin/admin-nav.tsx"),
    source("components/admin/admin-shell.tsx"),
    source("app/admin/layout.tsx"),
    source("lib/admin/data.ts"),
  ]);

  assert.match(nav, /^"use client";/m);
  assert.doesNotMatch(nav, /CurrentMember|role|email|token|session|permission/);
  assert.doesNotMatch(shell, /member=|role=|session=|token=/);
  assert.doesNotMatch(layout, /<AdminNav|role=\{|member=\{/);
  assert.doesNotMatch(data, /account\.password|session\.token|accessToken|refreshToken|idToken/);
});
