import "server-only";
import { redirect, notFound } from "next/navigation";
import { requireMember } from "@/lib/members/dal";
import { getSql } from "@/lib/members/db";
import { radarAccess } from "@/lib/billing/store";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { listRadarOpportunities } from "./radar-client";
import type { StudentOpportunity } from "./types";
export const personalCalendarEnabled = () => process.env.RADAR_CALENDAR_PERSONAL_ENABLED === "true";
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
  const rows=await getSql()`select opportunity_id,snapshot,removed_at from radar_saved_opportunity where user_id=${userId} order by saved_at`;
  return rows.map(r=>({id:String(r.opportunity_id),snapshot:r.snapshot as StudentOpportunity,removedAt:r.removed_at ? new Date(r.removed_at).toISOString():null}));
}
