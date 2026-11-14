import "server-only";
import { applicationOrigin } from "@/lib/members/mail";
import { radarDetailReturnPath } from "@/lib/opportunities/detail-path";
import { COMMUNITY_ACCESS_PATH } from "./community-config";
import { billingFailure } from "./http";

/** API clients keep status codes; native form navigation gets a readable recovery page. */
export function communityFailure(request:Request,error:unknown) {
  const response=billingFailure(error);
  try {
    if(!request.headers.get("accept")?.includes("text/html") || request.headers.get("origin")!==applicationOrigin() || request.headers.get("sec-fetch-site")==="cross-site") return response;
    const next=radarDetailReturnPath(new URL(request.url).searchParams.get("next"));
    const path=`${COMMUNITY_ACCESS_PATH}?next=${encodeURIComponent(next)}`;
    const destination=response.status===401 ? `/membros/entrar?next=${encodeURIComponent(path)}` : `${path}&billing_error=${response.status}`;
    return new Response(null,{status:303,headers:{Location:new URL(destination,applicationOrigin()).href,"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
  } catch { return response; }
}
