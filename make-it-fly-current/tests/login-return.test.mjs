import assert from "node:assert/strict";
import test from "node:test";
import * as navigation from "next/navigation.js";
import { getRedirectTypeFromError, getURLFromRedirectError } from "next/dist/client/components/redirect.js";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

const { safeNextPath } = opportunityLoader()("lib/members/validation.ts");

test("login preserves protected admin and gallery destinations including query and hash", () => {
  for (const path of ["/admin", "/admin/posts", "/admin/usuarios?pagina=2#resultados", "/gerenciar-galeria"])
    assert.equal(safeNextPath(path), path);
});

test("allowing admin returns does not allow external origins or lookalike paths", () => {
  for (const path of ["https://evil.example/admin", "//evil.example/admin", "javascript:alert(1)",
    "/administrator", "/admin-external", "/admin/../../loja", "/admin/%2e%2e/login",
    "/admin\\evil", "/gerenciar-galeria-extra", "/gerenciar-galeria/extra"])
    assert.equal(safeNextPath(path), "/membros", path);
});

function loginAction(authenticate) {
  return opportunityLoader({
    "next/headers": { headers: async () => new Headers() },
    // A Server Action defaults to push. Supply that request context here;
    // keep Next's real redirect error so the action's history policy is tested.
    "next/navigation": { ...navigation, redirect: (path, type = navigation.RedirectType.push) => navigation.redirect(path, type) },
    "next/cache": {},
    "@/lib/members/auth": { getAuth: () => ({ api: { signInEmail: authenticate } }) },
    "@/lib/members/dal": { clientIp: async () => "127.0.0.1" },
    "@/lib/members/rate-limit": { consumeRateLimit: async () => true },
    "@/lib/members/forum": {},
    "@/lib/billing/config": {},
    "@/lib/billing/store": {},
  })("app/membros/actions.ts").signIn;
}

test("successful password login replaces the login history entry with the filtered destination", async () => {
  const signIn = loginAction(async () => ({}));
  const form = new FormData();
  form.set("email", "navigation@example.invalid");
  form.set("password", "local-test-password");
  form.set("next", "/membros/oportunidades?categoria=competicoes&busca=Teste+local&pagina=2");
  await assert.rejects(signIn({}, form), error => {
    assert.equal(getURLFromRedirectError(error), "/membros/oportunidades?categoria=competicoes&busca=Teste+local&pagina=2");
    assert.equal(getRedirectTypeFromError(error), "replace");
    return true;
  });
});

test("rejected password login stays on the form without redirecting", async () => {
  const signIn = loginAction(async () => { throw { status: "UNAUTHORIZED", body: { code: "INVALID_EMAIL_OR_PASSWORD" } }; });
  const form = new FormData();
  form.set("email", "navigation@example.invalid");
  form.set("password", "incorrect-password");
  form.set("next", "/admin/posts");
  const result = await signIn({}, form);
  assert.equal(result.message, "E-mail ou senha incorretos.");
});

test("a safe admin return still refuses a signed-in member at the actual admin guard", async () => {
  const { requireAdmin } = opportunityLoader({
    "next/navigation": navigation,
    "@/lib/members/dal": { getCurrentMember: async () => ({ id: "local-member", role: "member" }) },
  })("lib/admin/access.ts");
  await assert.rejects(requireAdmin("/admin/posts"), error => {
    assert.equal(getURLFromRedirectError(error), "/admin/acesso-negado");
    return true;
  });
});
