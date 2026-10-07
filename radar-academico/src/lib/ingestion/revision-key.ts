import crypto from "node:crypto";

export function canonicalOpportunityKey(sourceId: string, title: string) {
  const normalized = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/retificacao|errata|prorrogacao|novo cronograma|republicacao/g, "")
    .replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
  return crypto.createHash("sha256").update(`${sourceId}|${normalized}`).digest("hex");
}