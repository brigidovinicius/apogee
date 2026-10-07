import type { FieldEvidence } from "./types";

export function evidence(sourceUrl: string, excerpt: string, page?: number): FieldEvidence {
  return { source_url: sourceUrl, excerpt: excerpt.slice(0, 1000), ...(page ? { page } : {}) };
}

export function generateEvidence(sourceUrl: string, text: string) {
  const compact = text.replace(/\s+/g, " ").trim();
  return {
    requirements: evidence(sourceUrl, compact),
    deadline_at: evidence(sourceUrl, compact),
    application_route: evidence(sourceUrl, compact),
  };
}