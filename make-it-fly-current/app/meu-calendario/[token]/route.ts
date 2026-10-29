import { calendarTokenOwner,savedOpportunities,rememberCalendarEvents } from "@/lib/opportunities/personal-calendar";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { renderCalendarFeed } from "@/lib/opportunities/ics";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export async function GET(_request:Request,{params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  if(!/^[a-f0-9]{64}\.ics$/.test(token))return new Response("Não encontrado",{status:404,headers});
  try {
    const owner=await calendarTokenOwner(token.slice(0,-4));
    if(!owner)return new Response("Não encontrado",{status:404,headers});
    const live=await listRadarOpportunities(true);
    await rememberCalendarEvents(owner,live);
    const saved=await savedOpportunities(owner);
    return new Response(renderCalendarFeed(saved,live),{headers:{...headers,"Content-Type":"text/calendar; charset=utf-8","Content-Disposition":'inline; filename="apogee.ics"'}});
  } catch { return new Response("Agenda temporariamente indisponível",{status:503,headers}); }
}
