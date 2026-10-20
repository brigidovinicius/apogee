import { getSql } from "@/lib/members/db";
import { memberClientIp } from "@/lib/members/client-ip";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { DROP_CONSENT_TEXT, DROP_CONSENT_VERSION, handleDropSignup } from "@/lib/store/drop-signups";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const allowedOrigins = ["https://www.apogee.community", "https://apogee.community"];
  if (process.env.NODE_ENV !== "production") allowedOrigins.push(new URL(request.url).origin);
  return handleDropSignup(request, {
    allowedOrigins,
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    clientIp: memberClientIp,
    consumeLimit: consumeRateLimit,
    save: async ({ name, phone, email }) => {
      // A repeated signup never overwrites another person's existing contact details.
      await getSql()`insert into store_drop_signup (name, phone, email, consent_version, consent_text)
        values (${name}, ${phone}, ${email}, ${DROP_CONSENT_VERSION}, ${DROP_CONSENT_TEXT})
        on conflict (email) do nothing`;
    },
  });
}
