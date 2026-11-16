import { localFunctionalReview } from "@/lib/offer-preview";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { adultAccess } from "@/lib/members/protection";
import { BillingError } from "@/lib/billing/config";
import { communityFailure } from "@/lib/billing/community-http";
import { annualCheckout } from "@/lib/billing/community-checkout";
import { communityReturnPath } from "@/lib/billing/community-navigation";

export async function POST(request:Request) {
  try {
    if(localFunctionalReview()) throw new BillingError(503,"A prévia local não realiza operações de pagamento.");
    if(request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403,"Origem não permitida.");
    const member=await getMemberFromHeaders(request.headers);
    if(!member) throw new BillingError(401,"Entre na sua conta para continuar.");
    if(!await adultAccess(member.id)) throw new BillingError(403,"Conclua a verificação da conta antes de contratar a comunidade.");
    if(!await consumeRateLimit(`annual-checkout:${member.id}`,10,3600)) throw new BillingError(429,"Aguarde antes de tentar novamente.");
    return Response.redirect(await annualCheckout(member.id,communityReturnPath(new URL(request.url).searchParams.get("next"))),303);
  } catch(error) { return communityFailure(request,error); }
}
