import { NextResponse } from "next/server";
import { getSql } from "@/lib/members/db";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { memberClientIp } from "@/lib/members/client-ip";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { localOfferPreview, localFunctionalReview } from "@/lib/offer-preview";
import { BillingError } from "@/lib/billing/config";
import { annualCheckout } from "@/lib/billing/community-checkout";
import { guestAnnualCheckout } from "@/lib/billing/community-guest-checkout";
import { GUEST_CHECKOUT_COOKIE } from "@/lib/billing/community-guest-store";
import { communityReturnPath } from "@/lib/billing/community-navigation";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    if (localOfferPreview() || localFunctionalReview()) throw new BillingError(503, "A prévia não realiza pagamentos.");
    if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403 });
    const ip = memberClientIp(request.headers);
    if (!ip || !await consumeRateLimit(`annual-start:${ip}`, 20, 3600)) throw new BillingError(429, "Aguarde antes de tentar novamente.");
    const member = await getMemberFromHeaders(request.headers);
    const next = communityReturnPath(new URL(request.url).searchParams.get("next") ?? "/membros");
    if (member) {
      const [unclaimed] = await getSql()`select g.id from community_guest_checkout g join "user" u on lower(u.email)=g.email
        where u.id=${member.id} and g.livemode=${process.env.STRIPE_MODE === "live"} and g.status='complete' and g.user_id is null limit 1`;
      if (unclaimed) return NextResponse.redirect(new URL("/membros/ativar-assinatura", applicationOrigin()), 303);
      if (!await consumeRateLimit(`annual-checkout:${member.id}`, 10, 3600)) throw new BillingError(429, "Aguarde antes de tentar novamente.");
      return NextResponse.redirect(await annualCheckout(member.id, next), 303);
    }
    const result = await guestAnnualCheckout((await cookies()).get(GUEST_CHECKOUT_COOKIE)?.value, next);
    const response = NextResponse.redirect(result.url, 303);
    response.cookies.set(GUEST_CHECKOUT_COOKIE, result.id, { httpOnly: true, secure: new URL(applicationOrigin()).protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof BillingError ? error.status : 503;
    return NextResponse.redirect(new URL(`/comunidade?checkout_error=${status}#plano-anual`, applicationOrigin()), 303);
  }
}
