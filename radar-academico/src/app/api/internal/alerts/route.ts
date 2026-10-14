import { isRadarConsumerAuthorized } from "@/lib/auth/radar-consumer";
import { readLimitedBody } from "@/lib/security";
import { AlertError, subscribeToOpportunity, updateAlertSubscription } from "@/lib/alerts/monitoring";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function POST(request:Request) {
  if (!isRadarConsumerAuthorized(request)) return Response.json({error:"Não autorizado"},{status:401,headers});
  let body;
  try { body=JSON.parse((await readLimitedBody(request,4096)).toString("utf8")); }
  catch { return Response.json({error:"Solicitação inválida"},{status:400,headers}); }
  try {
    if (!body || typeof body!=="object" || Array.isArray(body)) throw new AlertError("Solicitação inválida");
    if (body.action==="subscribe") return Response.json(await subscribeToOpportunity(body),{headers});
    if (body.action==="confirm" || body.action==="unsubscribe") return Response.json(await updateAlertSubscription(body.action,body.token),{headers});
    throw new AlertError("Solicitação inválida");
  } catch(error) { return Response.json({error:error instanceof AlertError?error.message:"Avisos indisponíveis"},{status:error instanceof AlertError?error.status:503,headers}); }
}
