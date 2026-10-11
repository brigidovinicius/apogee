import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../lib/blog/shared.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { blogSlug, isPublicPost, parseBrasiliaTime, statusLabel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("agendamento fica privado até a data definida", () => {
  const date = new Date("2026-10-12T12:00:00.000Z");
  const scheduled = { status: "scheduled", publishedAt: null, scheduledAt: date };
  assert.equal(isPublicPost(scheduled, new Date("2026-10-12T11:59:59.999Z")), false);
  assert.equal(isPublicPost(scheduled, date), true);
  assert.equal(statusLabel(scheduled, date), "Publicado");
  assert.equal(isPublicPost({ ...scheduled, status: "draft" }, date), false);
  assert.equal(isPublicPost({ ...scheduled, status: "archived" }, date), false);
});

test("publicação precisa de data e rascunhos nunca aparecem", () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  assert.equal(isPublicPost({ status: "published", publishedAt: null, scheduledAt: null }, now), false);
  assert.equal(isPublicPost({ status: "published", publishedAt: now, scheduledAt: null }, now), true);
  assert.equal(isPublicPost({ status: "draft", publishedAt: now, scheduledAt: null }, now), false);
});

test("horário de Brasília é convertido sem aceitar datas inválidas", () => {
  assert.equal(parseBrasiliaTime("2026-10-12T09:00")?.toISOString(), "2026-10-12T12:00:00.000Z");
  assert.equal(parseBrasiliaTime("2026-02-30T09:00"), null);
  assert.equal(parseBrasiliaTime("2026-10-12"), null);
  assert.equal(blogSlug("Ciências & Tecnologia: Próximos passos!"), "ciencias-tecnologia-proximos-passos");
});
