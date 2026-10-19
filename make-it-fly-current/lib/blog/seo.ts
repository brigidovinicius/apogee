import { blogSlug } from "./shared";

type SeoDraft = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
};

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function analyzeSeo(draft: SeoDraft) {
  const keyword = normalize(draft.focusKeyword);
  const containsKeyword = (value: string) => keyword.length >= 2
    && ` ${normalize(value)} `.includes(` ${keyword} `);
  const previewSlug = blogSlug(draft.slug || draft.title);
  const slug = previewSlug.replaceAll("-", " ");
  const firstParagraph = draft.body.split(/\n\s*\n/)[0] ?? "";
  return {
    previewSlug,
    previewTitle: draft.seoTitle.trim() || draft.title.trim(),
    previewDescription: draft.seoDescription.trim() || draft.excerpt.trim(),
    checks: [
      { label: "Palavra-chave no título", passed: containsKeyword(draft.title) },
      { label: "Palavra-chave no endereço", passed: containsKeyword(slug) },
      { label: "Palavra-chave no resumo", passed: containsKeyword(draft.excerpt) },
      { label: "Palavra-chave no primeiro parágrafo", passed: containsKeyword(firstParagraph) },
      { label: "Título para buscadores preenchido", passed: !!(draft.seoTitle.trim() || draft.title.trim()) },
      { label: "Descrição para buscadores preenchida", passed: !!(draft.seoDescription.trim() || draft.excerpt.trim()) },
    ],
  };
}
