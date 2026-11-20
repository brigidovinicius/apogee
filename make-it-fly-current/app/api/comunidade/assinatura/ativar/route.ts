import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { BillingError } from "@/lib/billing/config";
import { claimGuestAnnualCheckout } from "@/lib/billing/community-guest-checkout";
import { GUEST_CHECKOUT_COOKIE, validGuestId, refreshGuestSession } from "@/lib/billing/community-guest-store";
import { getSql } from "@/lib/members/db";
import { cookies } from "next/headers";
import { localOfferPreview, localFunctionalReview } from "@/lib/offer-preview";

export async function POST(request: Request) {
  try {
    if (localOfferPreview() || localFunctionalReview()) throw new BillingError(503, "A prévia não ativa assinaturas.");
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403, "Origem não permitida.");
    const member = await getMemberFromHeaders(request.headers);
    if (!member) throw new BillingError(401, "Entre na sua conta para continuar.");
    if (!await consumeRateLimit(`annual-claim:${member.id}`, 10, 3600)) throw new BillingError(429, "Aguarde antes de tentar novamente.");
    const id = (await cookies()).get(GUEST_CHECKOUT_COOKIE)?.value;
    if (validGuestId(id)) {
      const [row] = await getSql()`select session_id from community_guest_checkout where id=${id}`;
      if (row?.session_id) await refreshGuestSession(String(row.session_id));
    }
    const next = await claimGuestAnnualCheckout(member.id);
    return Response.json({ url: `/membros/assinatura?payment=received&next=${encodeURIComponent(next)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ message: error instanceof BillingError ? error.message : "Não foi possível confirmar sua assinatura agora. Tente novamente em instantes." }, { status: error instanceof BillingError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
