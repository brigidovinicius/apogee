import { getMemberFromHeaders } from "@/lib/members/dal";
import { getAuth } from "@/lib/members/auth";
import { getSql } from "@/lib/members/db";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { BillingError, billingConfig, RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { billingFailure } from "@/lib/billing/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") throw new BillingError(403, "Origem não permitida.");
    const member = await getMemberFromHeaders(request.headers);
    if (!member) throw new BillingError(401, "Entre na sua conta para continuar.");
    billingConfig();
    const [user] = await getSql()`select email, email_verified from "user" where id = ${member.id} and blocked = false`;
    if (!user) throw new BillingError(401, "Conta indisponível.");
    if (!user.email_verified) {
      if (!(await consumeRateLimit(`radar-verification:${member.id}`, 5, 3600))) throw new BillingError(429, "Aguarde antes de solicitar outro e-mail.");
      await getAuth().api.sendVerificationEmail({ headers: request.headers,
        body: { email: user.email, callbackURL: `${applicationOrigin()}${RADAR_ACCESS_PATH}` } });
    }
    return Response.redirect(new URL(`${RADAR_ACCESS_PATH}?verification=sent`, applicationOrigin()), 303);
  } catch (error) { return billingFailure(error); }
}
