"use server";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getAuth } from "@/lib/members/auth";
import { requireSignedInMember } from "@/lib/members/dal";
import { applicationOrigin } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { mcpEnabled } from "@/lib/mcp/config";
import { verifiedMcpQuery } from "@/lib/mcp/oauth";
import { revokeMcpConnection } from "@/lib/mcp/connections";

function assertOrigin(requestHeaders: Headers) {
  if (requestHeaders.get("origin") !== applicationOrigin()) throw new Error("Solicitação inválida.");
}
export async function decideMcpConsent(form: FormData) {
  if (!mcpEnabled()) notFound();
  const requestHeaders = await headers(); assertOrigin(requestHeaders);
  const raw = form.get("oauth_query");
  const query = typeof raw === "string" ? await verifiedMcpQuery(new URLSearchParams(raw)) : null;
  if (!query) throw new Error("Solicitação inválida ou expirada. Conecte a Apogee novamente.");
  const member = await requireSignedInMember(`/membros/integracoes/mcp/autorizar?${query}`);
  if (!(await consumeRateLimit(`mcp-consent:${member.id}`, 20, 600))) throw new Error("Aguarde alguns minutos antes de tentar novamente.");
  const decision = form.get("decision");
  if (decision !== "allow" && decision !== "deny") throw new Error("Confira sua decisão.");
  const result = await getAuth().api.oauth2Consent({ body: { accept: decision === "allow", oauth_query: query }, headers: requestHeaders });
  redirect(result.url);
}
export async function disconnectMcp(form: FormData) {
  if (!mcpEnabled()) notFound();
  assertOrigin(await headers());
  const member = await requireSignedInMember("/membros/integracoes/mcp");
  if (!(await consumeRateLimit(`mcp-revoke:${member.id}`, 20, 600))) throw new Error("Aguarde alguns minutos antes de tentar novamente.");
  const clientId = form.get("clientId");
  if (typeof clientId !== "string") throw new Error("Conexão inválida.");
  await revokeMcpConnection(member.id, clientId);
  redirect("/membros/integracoes/mcp?desconectado=1");
}
