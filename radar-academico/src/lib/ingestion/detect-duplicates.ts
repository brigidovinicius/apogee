import crypto from "node:crypto";
import type { OpportunityCandidate } from "./types";

export function candidateFingerprint(candidate: Pick<OpportunityCandidate, "officialSourceId" | "title" | "sourcePageUrl">) {
  return crypto.createHash("sha256")
    .update([candidate.officialSourceId, candidate.title.toLowerCase().trim(), candidate.sourcePageUrl].join("|"))
    .digest("hex");
}

export function deduplicateCandidates(candidates: OpportunityCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const fingerprint = candidateFingerprint(candidate);
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}