import { radarAlertRequest, readAlertBody } from "@/lib/opportunities/radar-alerts-client";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { createHash } from "node:crypto";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request) {
  const origin=request.headers.get("origin");
  const allowed=["https://www.apogee.community","https://apogee.community"];
  if (process.env.NODE_ENV!=="production") allowed.push(new URL(request.url).origin);
  if (!origin || !allowed.includes(origin)) return Response.json({error:"Solicitação inválida"},{status:403,headers});
  try {
    let body;
    try { body=await readAlertBody(request); }
    catch { return Response.json({error:"Solicitação inválida"},{status:400,headers}); }
    // No actor, callback URL, SMTP configuration or recipient list is forwarded from browsers.
    const payload=body.action==="subscribe" ? {action:"subscribe",opportunityId:body.opportunityId,email:body.email,consent:body.consent} :
      body.action==="confirm" || body.action==="unsubscribe" ? {action:body.action,token:body.token} : null;
    if (!payload) return Response.json({error:"Solicitação inválida"},{status:400,headers});
    // New subscriptions cannot exhaust the budget for an existing cancellation link.
    if (payload.action!=="subscribe" && (typeof payload.token!=="string" || !/^[a-f0-9]{64}$/.test(payload.token))) return Response.json({error:"Link inválido ou expirado"},{status:400,headers});
    const key=payload.action==="subscribe" ? "radar-alerts:subscribe" : `radar-alerts:${payload.action}:${createHash("sha256").update(payload.token as string).digest("hex")}`;
    if (!await consumeRateLimit(key,payload.action==="subscribe" ? 100 : 20,3600)) return Response.json({error:"Muitas solicitações. Tente mais tarde."},{status:429,headers});
    const result=await radarAlertRequest(payload);
    return Response.json(result.body,{status:result.status,headers});
  } catch { return Response.json({error:"Avisos indisponíveis"},{status:503,headers}); }
}
