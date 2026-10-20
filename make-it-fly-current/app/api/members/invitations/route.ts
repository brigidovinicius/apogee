import { z } from "zod";
import { acceptInvitation, createInvitation, listInvitations, resendInvitation, revokeInvitation } from "@/lib/members/invitations";
import { invitationActor, invitationBody, invitationFailure, invitationResponse } from "@/lib/members/invitation-http";
import { emailSchema, nameSchema } from "@/lib/members/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("create"), email: emailSchema, role: z.enum(["member", "admin"]) }),
  z.strictObject({ action: z.literal("resend"), id: z.uuid() }),
  z.strictObject({ action: z.literal("revoke"), id: z.uuid() }),
  z.strictObject({ action: z.literal("accept"), token: z.string().regex(/^[a-f0-9]{64}$/), name: nameSchema }),
]);
export async function GET(request: Request) {
  try { return invitationResponse({ invitations: await listInvitations(await invitationActor(request)) }); }
  catch (error) { return invitationFailure(error); }
}
export async function POST(request: Request) {
  try {
    const input = bodySchema.parse(await invitationBody(request));
    const actor = await invitationActor(request);
    switch (input.action) {
      case "create": return invitationResponse(await createInvitation(actor, input.email, input.role));
      case "resend": return invitationResponse(await resendInvitation(actor, input.id));
      case "revoke": return invitationResponse(await revokeInvitation(actor, input.id));
      case "accept": return invitationResponse(await acceptInvitation(actor, input.token, input.name));
    }
  } catch (error) { return invitationFailure(error); }
}
