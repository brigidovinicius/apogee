import type { FieldEvidence } from "./types";

export function evidence(sourceUrl: string, excerpt: string, page?: number): FieldEvidence {
  return { source_url: sourceUrl, excerpt: excerpt.slice(0, 1000), ...(page ? { page } : {}) };
}

export function generateEvidence(sourceUrl: string, text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  const around = (pattern: RegExp) => {
    const match = pattern.exec(compact);
    if (!match) return compact.slice(0, 1000);
    return compact.slice(Math.max(0, match.index - 120), Math.min(compact.length, match.index + 650));
  };
  return {
    requirements: evidence(sourceUrl, around(/requisitos|estudantes|discentes|alunos|graduandos|pós-graduandos/i)),
    deadline_at: evidence(sourceUrl, around(/inscriç(?:ão|ões)|candidaturas|submissões|prazo/i)),
    application_route: evidence(sourceUrl, around(/formulário de inscrição|inscreva-se|inscriç(?:ão|ões)|candidatura|submissão/i)),
    ...(/em todo o Brasil|de todo o Brasil|todo o território nacional|de qualquer (?:estado|cidade) do Brasil|de todo o país/i.test(compact)
      ? { national_scope: evidence(sourceUrl, around(/em todo o Brasil|de todo o Brasil|todo o território nacional|de qualquer (?:estado|cidade) do Brasil|de todo o país/i)) }
      : {}),
  };
}
