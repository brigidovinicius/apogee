import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

async function loadValidation() {
  const source = await readFile(new URL("../lib/members/validation.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    fileName: "validation.ts",
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", output)(require, loaded, loaded.exports);
  return loaded.exports;
}

const v = await loadValidation();

test("usernames are normalized to lowercase and restricted to a safe charset", () => {
  assert.equal(v.usernameSchema.parse("  Maria.Silva_1 "), "maria.silva_1");
  for (const bad of ["ab", "a".repeat(31), "maria silva", "maria-silva", "../admin", "joão"]) {
    assert.equal(v.usernameSchema.safeParse(bad).success, false, bad);
  }
});

test("reserved usernames cannot be registered, including the profile edit route", () => {
  for (const reserved of ["admin", "Apogee", "editar", "membros"]) {
    assert.equal(v.usernameSchema.safeParse(reserved).success, false, reserved);
  }
});

test("sign up requires name, valid e-mail and a password of 8 to 128 characters", () => {
  const valid = { name: "Maria", username: "maria", email: " Maria@Example.COM ", password: "12345678" };
  assert.equal(v.signUpSchema.parse(valid).email, "maria@example.com");
  assert.equal(v.signUpSchema.safeParse({ ...valid, password: "1234567" }).success, false);
  assert.equal(v.signUpSchema.safeParse({ ...valid, password: "x".repeat(129) }).success, false);
  assert.equal(v.signUpSchema.safeParse({ ...valid, email: "nao-e-email" }).success, false);
  assert.equal(v.signUpSchema.safeParse({ ...valid, name: " " }).success, false);
});

test("topics need a real title and body, and bodies are capped at 10k characters", () => {
  assert.equal(v.topicSchema.safeParse({ title: "Oi", body: "texto" }).success, false);
  assert.equal(v.topicSchema.safeParse({ title: "Título válido", body: " " }).success, false);
  assert.equal(v.topicSchema.safeParse({ title: "Título válido", body: "x".repeat(10_001) }).success, false);
  assert.deepEqual(v.topicSchema.parse({ title: "  Título válido ", body: " Olá " }), { title: "Título válido", body: "Olá" });
});

test("profile bio is optional and limited to 500 characters", () => {
  assert.equal(v.profileSchema.safeParse({ name: "Maria", bio: "" }).success, true);
  assert.equal(v.profileSchema.safeParse({ name: "Maria", bio: "x".repeat(501) }).success, false);
});

test("slugify strips accents and symbols and never returns an empty slug", () => {
  assert.equal(v.slugify("Como tirar a ideia do papel? Ação!"), "como-tirar-a-ideia-do-papel-acao");
  assert.equal(v.slugify("!!!"), "topico");
  assert.ok(v.slugify("a ".repeat(100)).length <= 80);
  assert.doesNotMatch(v.slugify("a ".repeat(100)), /-$/);
});

test("topic params round-trip and reject anything without a leading positive id", () => {
  assert.equal(v.parseTopicParam(v.topicParam(42, "como-voar")), 42);
  assert.equal(v.parseTopicParam("42"), 42);
  for (const bad of ["0-x", "-1", "abc", "42abc", "", "9999999999"]) {
    assert.equal(v.parseTopicParam(bad), null, bad);
  }
});

test("pagination only accepts sane positive integers", () => {
  assert.equal(v.parsePage("3"), 3);
  assert.equal(v.parsePage(["2", "5"]), 2);
  for (const bad of [undefined, "0", "-2", "1.5", "abc", "999999"]) assert.equal(v.parsePage(bad), 1);
});

test("post-login redirects stay inside the members area", () => {
  assert.equal(v.safeNextPath("/membros/forum/ideias"), "/membros/forum/ideias");
  assert.equal(v.safeNextPath("/membros/forum/ideias?pagina=2#fim"), "/membros/forum/ideias?pagina=2#fim");
  for (const bad of [
    "https://evil.example",
    "//evil.example",
    "/membrosexterno",
    "/membros/../login",
    "/membros/%2e%2e/login",
    "/membrosX\\evil",
    "/loja",
    undefined,
    42,
  ]) {
    assert.equal(v.safeNextPath(bad), "/membros", String(bad));
  }
});
