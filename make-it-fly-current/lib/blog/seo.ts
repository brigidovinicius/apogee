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

export function analyzeSeo(draft: SeoDraft) {
  const previewSlug = blogSlug(draft.slug || draft.title);
  const title = draft.seoTitle.trim() || draft.title.trim();
  const description = draft.seoDescription.trim() || draft.excerpt.trim();
  const paragraphs = draft.body.replace(/\r\n?/g, "\n").split(/\n\s*\n/).filter(Boolean);
  return {
    previewSlug,
    previewTitle: title,
    previewDescription: description,
    checks: [
      { label: "Título informativo preenchido", passed: draft.title.trim().length >= 8 && draft.title.length <= 140 },
      { label: "Endereço descritivo, sem identificador isolado", passed: !!previewSlug && !/^(?:apogee-)?[a-f0-9]{24,64}$/.test(previewSlug) },
      { label: "Resumo específico preenchido", passed: draft.excerpt.trim().length >= 20 },
      { label: "Texto organizado em parágrafos", passed: paragraphs.length >= 2 },
      { label: "Título para buscadores preenchido, até 70 caracteres", passed: title.length >= 8 && title.length <= 70 },
      { label: "Descrição para buscadores preenchida, até 160 caracteres", passed: description.length >= 20 && description.length <= 160 },
    ],
  };
}
