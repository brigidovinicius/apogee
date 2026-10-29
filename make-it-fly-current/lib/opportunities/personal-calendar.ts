import { calendarEntries, type CalendarFeedEntry } from "./discovery";
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { redirect, notFound } from "next/navigation";
import { requireMember } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";
import { radarAccess } from "@/lib/billing/store";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { listRadarOpportunities } from "./radar-client";
import type { StudentOpportunity } from "./types";
export const personalCalendarEnabled = () => process.env.RADAR_CALENDAR_PERSONAL_ENABLED === "true";
export const tokenHash = (token:string) => createHash("sha256").update(token).digest("hex");
export async function requireCalendarMember() {
  if(!personalCalendarEnabled())notFound();
  const member=await requireMember("/membros/meu-calendario");
  if(!(await radarAccess(member.id,process.env.STRIPE_MODE!=="test")).active)redirect(RADAR_ACCESS_PATH);
  return member;
}
export async function saveOpportunity(userId:string,id:string,remove:boolean) {
  if(!/^radar-[a-zA-Z0-9_-]{1,194}$/.test(id))throw Error("Oportunidade inválida");
  if(remove) {
    await getSql()`update radar_saved_opportunity set removed_at=now() where user_id=${userId} and opportunity_id=${id} and removed_at is null`;
    return;
  }
  const item=(await listRadarOpportunities(true)).find(i=>i.id===id);
  if(!item)throw Error("Oportunidade indisponível");
  // Drizzle configures this shared client with transparent JSON serializers.
  await getSql()`insert into radar_saved_opportunity (user_id,opportunity_id,snapshot) values (${userId},${id},${JSON.stringify(item)}::jsonb)
    on conflict (user_id,opportunity_id) do update set snapshot=excluded.snapshot,removed_at=null`;
}
export async function savedOpportunities(userId:string) {
  const rows=await getSql()`select opportunity_id,snapshot,removed_at,feed_history from radar_saved_opportunity where user_id=${userId} order by saved_at`;
  return rows.map(r=>({id:String(r.opportunity_id),snapshot:r.snapshot as StudentOpportunity,history:r.feed_history as CalendarFeedEntry[],removedAt:r.removed_at ? new Date(r.removed_at).toISOString():null}));
}
export async function rotateCalendarToken(userId:string) {
  const token=randomBytes(32).toString("hex");
  await getSql()`insert into radar_calendar_feed (user_id,token_hash) values (${userId},${tokenHash(token)})
    on conflict (user_id) do update set token_hash=excluded.token_hash,created_at=now()`;
  return token;
}
export async function calendarTokenOwner(token:string) {
  if(!personalCalendarEnabled() || !/^[a-f0-9]{64}$/.test(token))return null;
  const [row]=await getSql()`select user_id from radar_calendar_feed where token_hash=${tokenHash(token)}`;
  if(!row || !(await radarAccess(String(row.user_id),process.env.STRIPE_MODE!=="test")).active)return null;
  return String(row.user_id);
}


// Remember every exported UID so later removals can cancel stages added after saving.
export async function rememberCalendarEvents(userId:string,live:StudentOpportunity[]) {
  await getSql().begin(async tx=>{
    const rows=await tx`select opportunity_id,feed_history from radar_saved_opportunity where user_id=${userId} and removed_at is null for update`;
    for(const row of rows) {
      const current=live.find(i=>i.id===row.opportunity_id);
      if(!current)continue;
      const history=new Map((row.feed_history as CalendarFeedEntry[]).map(e=>[e.key,e]));
      for (const {key, stage, item} of calendarEntries([current], 0)) {
        // A compact export record avoids repeating the complete catalogue for every stage.
        const publicStage = {id: stage.id, name: stage.name, kind: stage.kind, start: stage.start, end: stage.end, checkedAt: stage.checkedAt};
        history.set(key, {key, stage: publicStage, item: {id: item.id, title: item.title}});
      }
      await tx`update radar_saved_opportunity set feed_history=${JSON.stringify([...history.values()])}::jsonb where user_id=${userId} and opportunity_id=${String(row.opportunity_id)}`;
    }
  });
}
