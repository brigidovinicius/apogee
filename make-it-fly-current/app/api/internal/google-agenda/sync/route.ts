import { timingSafeEqual } from "node:crypto";
import { syncDueGoogleCalendars } from "@/lib/opportunities/google-calendar-sync";
import { googleQueuePolicy,googleQueueStatus,recordGoogleWorkerHeartbeat } from "@/lib/opportunities/google-calendar-queue";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
function authorized(request: Request,write=false) {
  const syncSecret=process.env.GOOGLE_CALENDAR_SYNC_SECRET,monitorSecret=process.env.GOOGLE_CALENDAR_MONITOR_SECRET;
  if(monitorSecret&&monitorSecret===syncSecret)return false;
  const authorization = request.headers.get("authorization") ?? "";
  return (write?[syncSecret]:[syncSecret,monitorSecret]).some(secret=>{
    const expected='Bearer '+secret;
    return !!secret&&secret.length>=32&&Buffer.byteLength(authorization)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(authorization),Buffer.from(expected));
  });
}
async function report(processed=0) {
  const queue=await googleQueueStatus();
  const policy=googleQueuePolicy();
  return {processed,...queue,batchSize:policy.batchSize,healthy:queue.configured && queue.lagSeconds<=policy.maxLagSeconds &&
    !queue.errors && !queue.reconnect && !queue.paused && !queue.cooldownUntil && queue.workerHealthy!==false};
}
export async function POST(request: Request) {
  if(!authorized(request,true))return new Response(null,{status:401});
  try {
    const started=Date.now();
    await recordGoogleWorkerHeartbeat('running');
    const processed=await syncDueGoogleCalendars();
    await recordGoogleWorkerHeartbeat('ok');
    const result=await report(processed);
    return Response.json({...result,durationMs:Date.now()-started},{headers:{"Cache-Control":"no-store"}});
  } catch {
    try{await recordGoogleWorkerHeartbeat('failed');}catch{}
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
