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
    const config=communityServiceConfig(),portal=process.env.STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID ?? "";
    if(!/^bpc_[A-Za-z0-9]+$/.test(portal)) throw new BillingError(503,"Gestão da assinatura temporariamente indisponível.");
    if(!await consumeRateLimit(`annual-portal:${member.id}`,10,3600)) throw new BillingError(429,"Aguarde antes de tentar novamente.");
    const [owner]=await getSql()`select customer_id from (
      select customer_id,updated_at from community_subscription where user_id=${member.id} and livemode=${config.livemode}
      union all select customer_id,null::timestamptz from community_customer where user_id=${member.id} and livemode=${config.livemode}
    ) owned order by updated_at desc nulls last limit 1`;
    if(!owner) throw new BillingError(404,"Assinatura não encontrada.");
    const stripe=stripeClient();
    const configuration=await stripe.billingPortal.configurations.retrieve(portal);
    if(!configuration.active || configuration.livemode!==config.livemode || configuration.features.subscription_update.enabled ||
      (configuration.features.subscription_cancel.enabled && configuration.features.subscription_cancel.mode !== "at_period_end")) {
      throw new BillingError(503,"Gestão da assinatura temporariamente indisponível.");
    }
    const session=await stripe.billingPortal.sessions.create({customer:String(owner.customer_id),configuration:portal,return_url:`${applicationOrigin()}${COMMUNITY_ACCESS_PATH}?next=${encodeURIComponent(communityReturnPath(new URL(request.url).searchParams.get("next")))}`});
    if(new URL(session.url).origin !== "https://billing.stripe.com") throw new BillingError(503,"Gestão da assinatura indisponível.");
    return Response.redirect(session.url,303);
  } catch(error) { return communityFailure(request,error); }
}
