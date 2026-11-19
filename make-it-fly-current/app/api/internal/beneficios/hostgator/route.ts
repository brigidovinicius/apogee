import { getSql } from "@/lib/members/db";
import { readRequestBody } from "@/lib/request-body";
import { recordBenefitCheck } from "@/scripts/member-benefits-monitor.mjs";
import { rosaCampaign, rosaReferralUrl, verifyHostgatorProof } from "@/lib/benefits/hostgator-proof.mjs";
import benefitOffers from "@/content/benefit-offers.json";

export const runtime = "nodejs";

const reasons = {
  verified: "Promoção e atribuição confirmadas pelo verificador assinado",
  review: "Os termos ou o encaminhamento da promoção mudaram",
  unavailable: "A promoção saiu do destino oficial",
} as const;

export async function POST(request: Request) {
  const publicKey = process.env.APOGEE_HOSTGATOR_RECEIPT_PUBLIC_KEY;
  const campaign = rosaCampaign(benefitOffers);
  if (!publicKey || !campaign) return new Response(null, { status: 404 });
  if (!request.headers.get("x-apogee-proof")) return new Response(null, { status: 401 });
  let body;
  try { body = await readRequestBody(request, 1024); }
  catch { return new Response(null, { status: 400 }); }
  const observation = verifyHostgatorProof(body, request.headers.get("x-apogee-proof"), publicKey, campaign);
  if (!observation || !Object.hasOwn(reasons, observation.outcome)) return new Response(null, { status: 401 });

  const found = await getSql().begin(async tx => {
    const rows = await tx`select b.id,public.member_benefit_monitor_revision(b) as revision
      from member_benefit b
      where b.status='published'
        and lower(b.partner)='hostgator'
        and b.name=${campaign.condition}
        and b.eligibility=${campaign.eligibility}
        and b.availability=${campaign.availability}
        and b.redemption=${campaign.instructions}
        and b.evidence_url=${rosaReferralUrl}
        and b.redemption_url=${rosaReferralUrl}
      for share of b`;
    if (rows.length !== 1) return false;
    await recordBenefitCheck(tx, { ...rows[0], checkedAt: observation.checkedAt }, {
      outcome: observation.outcome,
      reason: reasons[observation.outcome as keyof typeof reasons],
    });
    return true;
  });
  return new Response(null, { status: found ? 204 : 409 });
}
