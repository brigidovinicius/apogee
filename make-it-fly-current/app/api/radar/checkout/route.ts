import { applicationOrigin } from "@/lib/members/mail";
import { BillingError } from "@/lib/billing/config";
import { billingFailure,billingResponse } from "@/lib/billing/http";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";

// Historical receipts/webhooks remain supported; no new one-time Radar sale.
export async function POST(request:Request) {
  try {
    if(request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403,"Origem não permitida.");
    const next=radarDetailReturnPath(new URL(request.url).searchParams.get("next"));
    const target=new URL(`/comunidade?next=${encodeURIComponent(next)}#planos`,applicationOrigin());
    if(request.headers.get("sec-fetch-mode") === "navigate" || request.headers.get("accept")?.includes("text/html")) return Response.redirect(target,303);
    return billingResponse({message:"O Radar completo faz parte da assinatura anual da comunidade.",communityUrl:target.toString()},410);
  } catch(error) { return billingFailure(error); }
}
