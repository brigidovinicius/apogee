import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { hostgatorProofBody, rosaCampaign, rosaReferralUrl, verifyHostgatorProof } from "../lib/benefits/hostgator-proof.mjs";
import { loadBenefitOffers } from "../scripts/member-benefits-monitor.mjs";

test("receipt binds the exact affiliate link, campaign content, outcome and time to a dedicated Ed25519 key", async () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const key = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const campaign = rosaCampaign(await loadBenefitOffers());
  assert.equal(campaign.redeem, rosaReferralUrl);
  assert.equal(rosaCampaign([{ ...campaign, redeem: "https://www.hostgator.com.br/" }]), undefined);
  const now = Date.parse("2026-11-19T12:00:00.000Z");
  const receipt = outcome => hostgatorProofBody(campaign, new Date(now - 1000).toISOString(), outcome);
  const signature = body => sign(null, body, privateKey).toString("base64url");
  const body = receipt("verified");
  assert.deepEqual(verifyHostgatorProof(body, signature(body), key, campaign, now),
    { checkedAt: new Date(now - 1000).toISOString(), outcome: "verified" });
  assert.equal(verifyHostgatorProof(receipt("review"), signature(body), key, campaign, now), null);
  assert.equal(verifyHostgatorProof(body, signature(body), key, { ...campaign, condition: "Alterado" }, now), null);
  assert.equal(verifyHostgatorProof(body, signature(body), key, campaign, now + 600_001), null);
  assert.equal(verifyHostgatorProof(body, signature(body), key, campaign, now - 2000), null);
  const temporary = receipt("temporary");
  assert.equal(verifyHostgatorProof(temporary, signature(temporary), key, campaign, now), null);
});
