import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function loadTypeScript(path) {
  const input = await source(path);
  const output = ts.transpileModule(input, {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
  return loaded.exports;
}

test("/login is the canonical Stack Auth entry and permits only safe returns", async () => {
  const [login, loginLayout, membersLayout, legacySignIn, legacySignUp] = await Promise.all([
    source("app/login/page.tsx"),
    source("app/login/layout.tsx"),
    source("app/membros/layout.tsx"),
    source("app/membros/entrar/page.tsx"),
    source("app/membros/cadastro/page.tsx"),
  ]);
  assert.match(login, /safeNextPath\(params\.next\)/);
  assert.match(login, /getCurrentMember\(\)/);
  assert.match(login, /redirect\(next\)/);
  assert.match(login, /<SignIn\s*\/>/);
  assert.doesNotMatch(login, /GOOGLE_CLIENT_SECRET/);
  for (const layout of [loginLayout, membersLayout]) {
    assert.match(layout, /<HexclaveProvider app=\{hexclaveServerApp\}>/);
  }
  for (const page of [legacySignIn, legacySignUp]) {
    assert.match(page, /redirect\(`\/login\?next=\$\{encodeURIComponent\(next\)\}`\)/);
  }
});

test("safe member return paths reject open redirects", async () => {
  const { safeNextPath } = await loadTypeScript("lib/members/validation.ts");
  assert.equal(safeNextPath("/membros/forum/ideias?pagina=2"), "/membros/forum/ideias?pagina=2");
  for (const unsafe of ["https://evil.example", "//evil.example", "/login", "/membros\\evil"]) {
    assert.equal(safeNextPath(unsafe), "/membros", unsafe);
  }
});

test("Hexclave uses the official Google callback and requested declarative product switches", async () => {
  const [urls, config, packageJson] = await Promise.all([
    loadTypeScript("lib/hexclave/urls.ts"),
    source("hexclave.config.ts"),
    source("package.json").then(JSON.parse),
  ]);
  assert.equal(urls.googleOAuthCallbackUrl, "https://api.hexclave.com/api/v1/auth/oauth/callback/google");
  for (const app of ["authentication", "payments", "emails", '"data-vault"', "analytics"]) {
    assert.match(config, new RegExp(`${app}:\\s*\\{\\s*enabled:\\s*true\\s*\\}`));
  }
  for (const method of ["password", "otp", "passkey"]) {
    assert.match(config, new RegExp(`${method}:\\s*\\{\\s*allowSignIn:\\s*true,?\\s*\\}`));
  }
  for (const provider of ["google", "github", "microsoft"]) {
    assert.match(config, new RegExp(`${provider}:\\s*\\{[\\s\\S]*type:\\s*"${provider}"[\\s\\S]*allowSignIn:\\s*true[\\s\\S]*allowConnectedAccounts:\\s*true`));
  }
  assert.match(config, /accountMergeStrategy:\s*"link_method"/);
  assert.match(config, /selectedThemeId:\s*"1df07ae6-abf3-4a40-83a5-a1a2cbe336ac"/);
  assert.doesNotMatch(config, /clientSecret|clientId/i);
  assert.equal(packageJson.devDependencies["@hexclave/cli"], "1.0.123");
  assert.equal(packageJson.scripts.dev, "hexclave dev --config-file ./hexclave.config.ts -- npm run dev:inner");
  assert.equal(packageJson.scripts["dev:inner"], "next dev --webpack");
});

test("member routes validate the Hexclave session and send unauthenticated traffic to /login", async () => {
  const [proxy, dal] = await Promise.all([source("proxy.ts"), source("lib/members/dal.ts")]);
  assert.match(proxy, /hexclaveServerApp\.getUser\(\{ tokenStore: request \}\)/);
  assert.match(proxy, /new URL\("\/login", request\.url\)/);
  assert.match(proxy, /login\.searchParams\.set\("next", pathname \+ search\)/);
  assert.match(dal, /hexclaveServerApp\.getUser\(\)/);
  assert.match(dal, /redirect\(next \? `\/login\?next=\$\{encodeURIComponent\(next\)\}` : "\/login"\)/);
});

test("logout delegates to the Stack Auth session and legacy forum identity is preserved", async () => {
  const [signOut, schema, migration, dal] = await Promise.all([
    source("components/members/sign-out-button.tsx"),
    source("lib/members/schema.ts"),
    source("drizzle/0001_curvy_dragon_man.sql"),
    source("lib/members/dal.ts"),
  ]);
  assert.match(signOut, /app\.signOut\(\{ redirectUrl: "\/login" \}\)/);
  assert.match(schema, /hexclaveIdentity/);
  assert.match(migration, /CREATE TABLE "hexclave_identity"/);
  assert.match(dal, /where\(eq\(user\.email, input\.primaryEmail\.toLowerCase\(\)\)\)/);
  assert.match(dal, /insert\(hexclaveIdentity\)/);
});
