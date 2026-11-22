import { getSql } from "@/lib/members/db";
import { memberClientIp } from "@/lib/members/client-ip";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { DROP_CONSENT_TEXT, DROP_CONSENT_VERSION, handleDropSignup } from "@/lib/store/drop-signups";
import { applicationOrigin } from "@/lib/members/mail";
import { localFunctionalReview, localStripeSandboxReview } from "@/lib/offer-preview";
import { recordDropSignupBehavior } from "@/lib/behavior";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const allowedOrigins = ["https://www.apogee.community", "https://apogee.community"];
  if (process.env.NODE_ENV !== "production") allowedOrigins.push(new URL(request.url).origin);
  if (localFunctionalReview() || localStripeSandboxReview()) allowedOrigins.push(applicationOrigin());
  return handleDropSignup(request, {
    allowedOrigins,
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    clientIp: memberClientIp,
    consumeLimit: consumeRateLimit,
    save: async ({ name, phone, email, productSlug }) => {
      // A repeated signup never overwrites another person's existing contact details.
      const [changed] = await getSql()`insert into store_drop_signup (name, phone, email, consent_version, consent_text, product_slugs)
        values (${name}, ${phone}, ${email}, ${DROP_CONSENT_VERSION}, ${DROP_CONSENT_TEXT}, array[${productSlug}::text])
        on conflict (email) do update set product_slugs = array_append(store_drop_signup.product_slugs, ${productSlug}::text)
        where not (${productSlug}::text = any(store_drop_signup.product_slugs))
        returning id`;
      if (changed) await recordDropSignupBehavior(request.headers);
    },
  });
}
