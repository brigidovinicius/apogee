import { timingSafeEqual } from "node:crypto";
import { syncDueGoogleCalendars } from "@/lib/opportunities/google-calendar-sync";
import { googleQueuePolicy,googleQueueStatus } from "@/lib/opportunities/google-calendar-queue";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
function authorized(request: Request) {
  const secret = process.env.GOOGLE_CALENDAR_SYNC_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = "Bearer "+secret;
  if (!secret || secret.length<32 || Buffer.byteLength(authorization)!==Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(authorization),Buffer.from(expected))) return false;
  return true;
}
async function report(processed=0) {
  const queue=await googleQueueStatus();
  const policy=googleQueuePolicy();
  return {processed,...queue,batchSize:policy.batchSize,healthy:queue.configured && queue.lagSeconds<=policy.maxLagSeconds &&
    !queue.errors && !queue.reconnect && !queue.paused && !queue.cooldownUntil};
}
export async function POST(request: Request) {
  if(!authorized(request))return new Response(null,{status:401});
  try {
    const started=Date.now();
    const result=await report(await syncDueGoogleCalendars());
    return Response.json({...result,durationMs:Date.now()-started},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({error:"Sincronização temporariamente indisponível"},{status:503});
  }
}
export async function GET(request: Request) {
  if(!authorized(request))return new Response(null,{status:401});
  try {
    const result=await report();
    return Response.json(result,{status:result.healthy?200:503,headers:{"Cache-Control":"no-store"}});
  } catch {return Response.json({error:"Monitoramento temporariamente indisponível"},{status:503});}
}
