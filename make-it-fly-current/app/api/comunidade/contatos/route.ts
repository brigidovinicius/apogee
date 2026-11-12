import { getSql } from "@/lib/members/db";
import { memberClientIp } from "@/lib/members/client-ip";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { COMMUNITY_CONTACT_CONSENT, COMMUNITY_CONTACT_VERSION } from "@/lib/community/consent";
import { handleCommunityContact } from "@/lib/community/contacts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const allowedOrigins = ["https://www.apogee.community", "https://apogee.community"];
  if (process.env.NODE_ENV !== "production") allowedOrigins.push(new URL(request.url).origin);
  return handleCommunityContact(request, {
    allowedOrigins,
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    clientIp: memberClientIp,
    consumeLimit: consumeRateLimit,
    save: async ({ campaign, name, email, goal }) => {
      // A duplicate never replaces the original contact or consent evidence.
      await getSql()`insert into community_contact (campaign, name, email, goal, consent_version, consent_text)
        values (${campaign}, ${name}, ${email}, ${goal}, ${COMMUNITY_CONTACT_VERSION}, ${COMMUNITY_CONTACT_CONSENT[campaign]})
        on conflict (campaign, email) do nothing`;
    },
  });
}
