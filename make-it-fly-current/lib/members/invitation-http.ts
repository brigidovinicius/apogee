import "server-only";
import { RequestBodyError, readRequestBody } from "@/lib/request-body";
import { z } from "zod";
import { getAuth } from "./auth";
import { InvitationError } from "./invitations";
import { applicationOrigin } from "./mail";

export async function invitationActor(request: Request): Promise<string> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) throw new InvitationError(401, "Entre na sua conta para continuar.");
  return session.user.id;
}
export async function invitationBody(request: Request): Promise<unknown> {
  if (request.headers.get("origin") !== applicationOrigin() || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new InvitationError(403, "Origem da solicitação não permitida.");
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new InvitationError(415, "Envie JSON válido.");
  try {
    return JSON.parse((await readRequestBody(request, 4096)).toString("utf8"));
  } catch (error) {
    if (error instanceof RequestBodyError) throw new InvitationError(error.status, error.message);
    throw new InvitationError(400, "Solicitação inválida.");
  }
}
export function invitationFailure(error: unknown): Response {
  if (error instanceof InvitationError) return invitationResponse({ message: error.message }, error.status);
  if (error instanceof z.ZodError) return invitationResponse({ message: error.issues[0]?.message ?? "Solicitação inválida." }, 400);
  // Não registrar URL/token, cabeçalhos de sessão ou mensagens do banco/provedor.
  console.error("[convites] operação não concluída");
  return invitationResponse({ message: "Não foi possível concluir a operação agora." }, 503);
}
export function invitationResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
