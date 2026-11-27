"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/members/auth";
import { requireSignedInMember } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { emailVerificationDestination } from "@/lib/members/validation";

export async function sendMemberVerification(form: FormData) {
  const next = emailVerificationDestination(form.get("next"));
  const path = "/membros/protecao?next=" + encodeURIComponent(next);
  const member = await requireSignedInMember(path);
  const [account] = await getSql()`select email, email_verified from "user" where id=${member.id} and not blocked`;
  if (account?.email_verified) redirect(next);

  let result = "erro";
  try {
    if (account && await consumeRateLimit("member-email-confirmation:" + member.id, 6, 60)) {
      await getAuth().api.sendVerificationEmail({
        headers: await headers(),
        body: { email: String(account.email), callbackURL: applicationOrigin() + path },
      });
      result = "enviado";
    }
  } catch {
    // Surface mail failures without exposing account or provider details.
  }
  redirect(path + "&resultado=" + result);
}
