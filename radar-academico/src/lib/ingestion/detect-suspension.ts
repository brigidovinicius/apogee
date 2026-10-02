import type { OpportunityStatus } from "./types";

export function detectSuspension(text: string): OpportunityStatus | null {
  const value = text.toLowerCase();
  if (/cancelamento|cancelado|revogaç(ão|ões)/.test(value)) return "cancelled";
  if (/suspensão|suspenso/.test(value)) return "suspended";
  return null;
}