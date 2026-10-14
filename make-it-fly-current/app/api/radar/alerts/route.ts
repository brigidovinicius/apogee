import { radarAlertRequest, readAlertBody } from "@/lib/opportunities/radar-alerts-client";
import { consumeRateLimit } from "@/lib/members/rate-limit";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request) {
  const origin=request.headers.get("origin");
  const allowed=["https://www.apogee.community","https://apogee.community"];
  if (process.env.NODE_ENV!=="production") allowed.push(new URL(request.url).origin);
  if (!origin || !allowed.includes(origin)) return Response.json({error:"Solicitação inválida"},{status:403,headers});
  try {
    if (!await consumeRateLimit("radar-alerts:requests",100,3600)) return Response.json({error:"Muitas solicitações. Tente mais tarde."},{status:429,headers});
    let body;
    try { body=await readAlertBody(request); }
    catch { return Response.json({error:"Solicitação inválida"},{status:400,headers}); }
    // No actor, callback URL, SMTP configuration or recipient list is forwarded from browsers.
    const payload=body.action==="subscribe" ? {action:"subscribe",opportunityId:body.opportunityId,email:body.email,consent:body.consent} :
      body.action==="confirm" || body.action==="unsubscribe" ? {action:body.action,token:body.token} : null;
    if (!payload) return Response.json({error:"Solicitação inválida"},{status:400,headers});
    const result=await radarAlertRequest(payload);
    return Response.json(result.body,{status:result.status,headers});
  } catch { return Response.json({error:"Avisos indisponíveis"},{status:503,headers}); }
}
