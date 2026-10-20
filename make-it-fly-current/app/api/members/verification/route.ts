import { z } from "zod";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/members/auth";
import { getDb } from "@/lib/members/db";
import { user } from "@/lib/members/schema";
import { InvitationError } from "@/lib/members/invitations";
import { invitationActor, invitationBody, invitationFailure, invitationResponse } from "@/lib/members/invitation-http";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { safeNextPath } from "@/lib/members/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const id = await invitationActor(request);
    const input = z.strictObject({ next: z.string().max(512) }).parse(await invitationBody(request));
    const [account] = await getDb().select().from(user).where(eq(user.id, id));
    if (!account || account.blocked) throw new InvitationError(403, "Conta indisponível.");
    if (account.emailVerified) return invitationResponse({ message: "Seu e-mail já está verificado. Volte ao convite." });
    if (!(await consumeRateLimit(`invitation:verification:${id}`, 5, 3600))) throw new InvitationError(429, "Aguarde antes de solicitar outro e-mail.");
    await getAuth().api.sendVerificationEmail({ headers: request.headers,
      body: { email: account.email, callbackURL: new URL(safeNextPath(input.next), applicationOrigin()).href } });
    return invitationResponse({ message: "Verificação enviada ao provedor. Confira sua caixa de e-mail e volte ao convite." });
  } catch (error) { return invitationFailure(error); }
}
