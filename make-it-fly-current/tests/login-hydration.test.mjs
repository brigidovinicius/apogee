import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { opportunityLoader } from "./helpers/load-opportunity-module.mjs";

test("password login cannot submit a native POST before the history-aware client action hydrates", () => {
  const { SignInForm } = opportunityLoader({
    "better-auth/client": { createAuthClient: () => ({}) },
    "@/app/membros/actions": { signIn: async () => ({}), signUp: async () => ({}) },
  })("components/members/auth-forms.tsx");
  const html = renderToStaticMarkup(createElement(SignInForm, { next: "/gerenciar-galeria" }));
  const passwordSubmit = html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
  assert.ok(passwordSubmit, "the form retains its password submit button");
  assert.match(passwordSubmit, /\bdisabled(?:="")?(?:\s|>)/,
    "SSR must block a native form POST that adds the login to browser history");
  assert.match(html, /name="next" value="\/gerenciar-galeria"/);
});
