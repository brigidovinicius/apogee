import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

async function load(path, edits = (value) => value) {
  const source = edits(readFileSync(new URL(path, import.meta.url), "utf8"));
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

const { parseVideoUrl } = await load("../lib/blog/video.ts");
const { analyzeSeo } = await load("../lib/blog/seo.ts", (source) => source.replace('import { blogSlug } from "./shared";', 'const blogSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");'));

test("vídeos permitidos recebem embed seguro", () => {
  assert.deepEqual(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), { provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  assert.deepEqual(parseVideoUrl("https://vimeo.com/123456789"), { provider: "Vimeo", src: "https://player.vimeo.com/video/123456789" });
  for (const value of ["http://youtube.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ", "https://evil.test/video", "javascript:alert(1)"]) {
    assert.equal(parseVideoUrl(value), null);
  }
});

test("análise SEO encontra expressão completa sem depender de meta keywords", () => {
  const result = analyzeSeo({ title: "Bolsas de estudo abertas", slug: "bolsas-de-estudo", excerpt: "Veja bolsas de estudo para 2026.", body: "Bolsas de estudo ajudam estudantes.\n\nSegundo parágrafo.", seoTitle: "", seoDescription: "", focusKeyword: "bolsas de estudo" });
  assert.equal(result.checks.every((check) => check.passed), true);
  assert.equal(result.previewTitle, "Bolsas de estudo abertas");
  assert.equal(result.previewDescription, "Veja bolsas de estudo para 2026.");
  const absent = analyzeSeo({ title: "Estudos", slug: "estudos", excerpt: "Bolsa de estudos", body: "Outro texto", seoTitle: "", seoDescription: "", focusKeyword: "bolsas de estudo" });
  assert.equal(absent.checks[0].passed, false);
  assert.equal(absent.checks[2].passed, false);
});
