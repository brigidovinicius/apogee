import { localFunctionalReview } from "@/lib/offer-preview";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { getSql } from "@/lib/members/db";
import { BillingError } from "@/lib/billing/config";
import { communityFailure } from "@/lib/billing/community-http";
import { communityBillingConfig,COMMUNITY_ACCESS_PATH } from "@/lib/billing/community-config";
import { stripeClient } from "@/lib/billing/stripe";

export async function POST(request:Request) {
  try {
    if(localFunctionalReview()) throw new BillingError(503,"A prévia local não realiza operações de pagamento.");
    if(request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403,"Origem não permitida.");
    const member=await getMemberFromHeaders(request.headers);
    if(!member) throw new BillingError(401,"Entre na sua conta para continuar.");
    const {livemode}=communityBillingConfig();
    if(!await consumeRateLimit(`annual-cancel:${member.id}`,10,3600)) throw new BillingError(429,"Aguarde antes de tentar novamente.");
    const rows=await getSql()`select s.id,s.customer_id from community_subscription s join community_customer c
      on c.user_id=s.user_id and c.customer_id=s.customer_id and c.livemode=s.livemode
      where s.user_id=${member.id} and s.livemode=${livemode} and s.status not in ('canceled','incomplete_expired') order by s.updated_at desc`;
    if(rows.length !== 1) throw new BillingError(409,"Confira a situação da sua assinatura antes de cancelar.");
    const stripe=stripeClient(),current=await stripe.subscriptions.retrieve(String(rows[0].id));
    const customer=typeof current.customer === "string" ? current.customer : current.customer.id;
    if(current.livemode !== livemode || customer !== rows[0].customer_id) throw new BillingError(409,"Assinatura indisponível.");
    await stripe.subscriptions.update(current.id,{cancel_at_period_end:true},{idempotencyKey:`community-cancel-${current.id}`});
    // Webhooks remain authoritative for local state and paid-through access.
    return Response.redirect(new URL(`${COMMUNITY_ACCESS_PATH}?cancellation=requested`,applicationOrigin()),303);
  } catch(error) { return communityFailure(request,error); }
}
