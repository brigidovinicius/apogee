import crypto from "node:crypto";

export function canonicalOpportunityKey(sourceId: string, title: string, sourcePageUrl?: string) {
  // FAPESP reuses short fellowship titles for distinct projects. Its stable
  // numeric posting ID identifies each application independently.
  if (sourceId === "fapesp-open-fellowships" && sourcePageUrl) {
    const match = /^https:\/\/(?:www\.)?fapesp\.br\/oportunidades\/[^/]+\/(\d+)\/$/.exec(sourcePageUrl);
    if (match) return crypto.createHash("sha256").update(`${sourceId}|posting:${match[1]}`).digest("hex");
  }
  const normalized = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/retificacao|errata|prorrogacao|novo cronograma|republicacao/g, "")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  return crypto.createHash("sha256").update(`${sourceId}|${normalized}`).digest("hex");
}
