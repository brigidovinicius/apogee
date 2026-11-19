import { createHash, createPublicKey, verify } from "node:crypto";

export const rosaCampaignId = "hostgator-rosa";
export const rosaReferralUrl = "https://www.hostgator.com.br/53289-77-3-32.html";
const outcomes = new Set(["verified", "review", "unavailable"]);

export function rosaCampaign(offers) {
  return offers.find(offer => offer.id === rosaCampaignId && offer.source === rosaReferralUrl && offer.redeem === rosaReferralUrl);
}

export function hostgatorProofBody(campaign, checkedAt, outcome) {
  return Buffer.from(JSON.stringify({
    campaign: rosaCampaignId,
    rule: createHash("sha256").update(JSON.stringify(campaign)).digest("hex"),
    checkedAt,
    outcome,
  }));
}

export function verifyHostgatorProof(body, signature, key, campaign, now = Date.now()) {
  if (!/^[\w-]{86}$/.test(signature ?? "") || !/^[A-Za-z0-9+/=]{59,64}$/.test(key)) return null;
  try {
    const publicKey = createPublicKey({ key: Buffer.from(key, "base64"), format: "der", type: "spki" });
    if (publicKey.asymmetricKeyType !== "ed25519" || !verify(null, body, publicKey, Buffer.from(signature, "base64url"))) return null;
    const receipt = JSON.parse(body.toString("utf8"));
    if (!outcomes.has(receipt?.outcome) || typeof receipt.checkedAt !== "string") return null;
    const observed = Date.parse(receipt.checkedAt);
    if (!Number.isFinite(observed) || receipt.checkedAt !== new Date(observed).toISOString() || observed > now || now - observed > 600_000) return null;
    if (!hostgatorProofBody(campaign, receipt.checkedAt, receipt.outcome).equals(body)) return null;
    return { checkedAt: receipt.checkedAt, outcome: receipt.outcome };
  } catch {
    return null;
  }
}
