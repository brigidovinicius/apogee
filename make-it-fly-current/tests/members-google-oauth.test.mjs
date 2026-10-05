import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadTypeScript(path) {
  const source = await readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)((specifier) => (
    specifier === "server-only" ? {} : require(specifier)
  ), loaded, loaded.exports);
  return loaded.exports;
}

test("Google OAuth uses a stable, valid non-identifying forum username", async () => {
  const { googleUsernameFromSubject } = await loadTypeScript("lib/members/google-oauth.ts");
  const first = googleUsernameFromSubject("google-subject-a");
  assert.match(first, /^google_[a-f0-9]{20}$/);
  assert.equal(first, googleUsernameFromSubject("google-subject-a"));
  assert.notEqual(first, googleUsernameFromSubject("google-subject-b"));
});

test("Google OAuth errors are safe and actionable without exposing provider details", async () => {
  const { googleOAuthErrorMessage } = await loadTypeScript("lib/members/social-auth.ts");
  assert.equal(googleOAuthErrorMessage("access_denied"), "A autorização com o Google foi cancelada.");
  assert.match(googleOAuthErrorMessage("upstream_private_detail"), /^Não foi possível concluir/);
  assert.equal(googleOAuthErrorMessage(undefined), undefined);
});

test("Google is configured through Stack Auth Cloud without local OAuth secrets", async () => {
  const [config, urls, login, example] = await Promise.all([
    readFile(new URL("../hexclave.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/hexclave/urls.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(config, /google:\s*\{[\s\S]*type:\s*"google"[\s\S]*allowSignIn:\s*true/);
  assert.match(config, /accountMergeStrategy:\s*"link_method"/);
  assert.match(urls, /https:\/\/api\.hexclave\.com\/api\/v1\/auth\/oauth\/callback\/google/);
  assert.match(login, /<SignIn\s*\/>/);
  assert.match(example, /^NEXT_PUBLIC_HEXCLAVE_PROJECT_ID=$/m);
  assert.match(example, /^HEXCLAVE_PROJECT_ID=$/m);
  assert.match(example, /^HEXCLAVE_SECRET_SERVER_KEY=$/m);
  assert.doesNotMatch(config, /clientSecret|clientId/i);
  assert.doesNotMatch(example, /^NEXT_PUBLIC_.*(?:SECRET|GOOGLE_CLIENT)/m);
});
