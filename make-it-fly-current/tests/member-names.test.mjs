import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";
const load = opportunityLoader();
const { nameSchema } = load("lib/members/validation.ts");
const { canInvite } = load("lib/admin/invitation-policy.ts");

test("nomes Unicode e iniciais legítimas são preservados e normalizados", () => {
  for (const name of ["Vinícius Brígido", "João D’Ávila", "Ana-Maria", "Ana M.", "李小龍", "محمد", "A", "O'Neill", "A. M.", "Jean Luc"]) {
    assert.equal(nameSchema.parse(name), name);
  }
  assert.equal(nameSchema.parse("  Vini\u0301cius\u00a0  Brígido  "), "Vinícius Brígido");
  assert.equal(nameSchema.parse("a".repeat(100)).length, 100);
  assert.equal([...nameSchema.parse("𠮷".repeat(100))].length, 100);
});

test("links, e-mails, esquemas, codificações, controles e injeções não passam na regra central", () => {
  for (const name of ["https://example.com", "www.example.com", "example.com", "João https://example.com", "//example.com", "javascript:alert(1)", "data:text/html,x", "João example.com", "ana@example.com", "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "Robert'); DROP TABLE user;--", "João OR 1=1", "", " ", null, 42, {}, ["Ana"], "a".repeat(101), "João\u200bSilva", "João\u202ecom", "João\nSilva", "João\tSilva", "ｅｘａｍｐｌｅ．ｃｏｍ", "example。com", "example\u2024com", "https%3A%2F%2Fexample.com", "https&#58;//example.com", "example . com", "Ana M.com"]) {
    assert.equal(nameSchema.safeParse(name).success, false, JSON.stringify(name));
  }
});

test("convites de administrador exigem autorização adicional e conta ativa", () => {
  const actor = { role: "admin", blocked: false, canManageAdmins: false };
  assert.equal(canInvite(actor, "member"), true);
  assert.equal(canInvite(actor, "admin"), false);
  assert.equal(canInvite({ ...actor, canManageAdmins: true }, "admin"), true);
  for (const denied of [null, { ...actor, role: "member", canManageAdmins: true }, { ...actor, blocked: true, canManageAdmins: true }]) {
    assert.equal(canInvite(denied, "member"), false);
    assert.equal(canInvite(denied, "admin"), false);
  }
});

test("nome malicioso legado permanece texto inerte no painel real", async () => {
  const malicious = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const pageLoad = opportunityLoader({ "@/lib/admin/data": {
    listAdminUsers: async () => ({ total: 1, limited: false, users: [{ id: "fixture", name: malicious,
      email: "fixture@example.test", username: "fixture", role: "member", emailVerified: true, createdAt: new Date() }] }),
  } });
  const page = pageLoad("app/admin/usuarios/page.tsx").default;
  const html = renderToStaticMarkup(await page({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(html, /<script|<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;script&gt;/);
});
