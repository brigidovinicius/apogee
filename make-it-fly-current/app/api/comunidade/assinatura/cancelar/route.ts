import { localFunctionalReview } from "@/lib/offer-preview";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { getSql } from "@/lib/members/db";
import { BillingError } from "@/lib/billing/config";
import { communityFailure } from "@/lib/billing/community-http";
import { communityServiceConfig,COMMUNITY_ACCESS_PATH } from "@/lib/billing/community-config";
import { communityReturnPath } from "@/lib/billing/community-navigation";
import { stripeClient } from "@/lib/billing/stripe";

export async function POST(request:Request) {
  try {
    if(localFunctionalReview()) throw new BillingError(503,"A prévia local não realiza operações de pagamento.");
    if(request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403,"Origem não permitida.");
    const member=await getMemberFromHeaders(request.headers);
    if(!member) throw new BillingError(401,"Entre na sua conta para continuar.");
    const {livemode}=communityServiceConfig();
    if(!await consumeRateLimit(`annual-cancel:${member.id}`,10,3600)) throw new BillingError(429,"Aguarde antes de tentar novamente.");
    const rows=await getSql()`select s.id,s.customer_id from community_subscription s join (select user_id,customer_id,livemode from community_customer union select user_id,customer_id,livemode from community_guest_checkout where user_id is not null) c
      on c.user_id=s.user_id and c.customer_id=s.customer_id and c.livemode=s.livemode
      where s.user_id=${member.id} and s.livemode=${livemode} and s.status not in ('canceled','incomplete_expired') order by s.updated_at desc`;
    if(rows.length !== 1) throw new BillingError(409,"Confira a situação da sua assinatura antes de cancelar.");
    const stripe=stripeClient(),current=await stripe.subscriptions.retrieve(String(rows[0].id));
    const customer=typeof current.customer === "string" ? current.customer : current.customer.id;
    if(current.livemode !== livemode || customer !== rows[0].customer_id) throw new BillingError(409,"Assinatura indisponível.");
    // Setting true is idempotent. A permanent key would replay a stale response
    // after the member resumes renewal in the portal and cancels again.
    if (!current.cancel_at_period_end) await stripe.subscriptions.update(current.id,{cancel_at_period_end:true});
    // Webhooks remain authoritative for local state and paid-through access.
    return Response.redirect(new URL(`${COMMUNITY_ACCESS_PATH}?cancellation=requested&next=${encodeURIComponent(communityReturnPath(new URL(request.url).searchParams.get("next")))}`,applicationOrigin()),303);
  } catch(error) { return communityFailure(request,error); }
}
