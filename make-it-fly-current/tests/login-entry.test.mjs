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
  new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
  return loaded.exports;
}

test("/login is the public login entry and forwards only a safe next path", async () => {
  const source = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
  assert.match(source, /searchParams:\s*Promise<\{\s*next\?:\s*string\s*\}>/);
  assert.match(source, /safeNextPath\(params\.next\)/);
  assert.match(source, /redirect\(`\/membros\/entrar\?next=\$\{encodeURIComponent\(next\)\}`\)/);
  assert.doesNotMatch(source, /params\.error/);
});

test("/login rejects external next values before it reaches the member login", async () => {
  const { safeNextPath } = await loadTypeScript("lib/members/validation.ts");
  assert.equal(safeNextPath("/membros/forum/ideias?pagina=2"), "/membros/forum/ideias?pagina=2");
  assert.equal(safeNextPath("/membros/forum/ideias?pagina=2#fim"), "/membros/forum/ideias?pagina=2#fim");
  for (const unsafe of [
    "https://evil.example",
    "//evil.example",
    "/login",
    "/membrosexterno",
    "/membros/../login",
    "/membros/%2e%2e/login",
    "/membros\\evil",
  ]) {
    assert.equal(safeNextPath(unsafe), "/membros", unsafe);
  }
});

test("the final member login keeps the Google button and sanitized OAuth errors", async () => {
  const [forms, socialAuth] = await Promise.all([
    readFile(new URL("../components/members/auth-forms.tsx", import.meta.url), "utf8"),
    loadTypeScript("lib/members/social-auth.ts"),
  ]);
  assert.match(forms, /"Entrar com Google"/);
  assert.match(forms, /googleOAuthErrorMessage\(result\.error\.code\)/);
  assert.match(forms, /Não foi possível iniciar a entrada com Google\. Tente novamente\./);
  assert.equal(socialAuth.googleOAuthErrorMessage("provider_internal_detail"), "Não foi possível concluir a entrada com Google. Tente novamente.");
});
