import "server-only";
import { redirect, notFound } from "next/navigation";
import { getCurrentMember } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { isGeneratedGoogleUsername } from "@/lib/members/validation";
import { calendarReturnPath } from './calendar-navigation';
import type { CalendarSaveState } from './calendar-save-types';
import { getSql } from "@/lib/members/db";
import { radarAccess } from "@/lib/billing/store";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { listRadarOpportunities } from "./radar-client";
import type { StudentOpportunity } from "./types";
export const personalCalendarEnabled = () => process.env.RADAR_CALENDAR_PERSONAL_ENABLED === "true";
export async function calendarSaveAccess(returnTo:unknown='/membros/meu-calendario') {
  if(!personalCalendarEnabled())return {kind:'disabled'} as const;
  const next=calendarReturnPath(returnTo);
  const member=await getCurrentMember();
  if(!member)return {kind:'redirect',href:'/membros/entrar?next='+encodeURIComponent(next)} as const;
  if(isGeneratedGoogleUsername(member.username)||member.nameNeedsConfirmation)return {kind:'redirect',href:'/membros/perfil/configurar?next='+encodeURIComponent(next)} as const;
  if(!(await adultAccess(member.id)))return {kind:'redirect',href:'/membros/protecao?next='+encodeURIComponent(next)} as const;
  if(!(await radarAccess(member.id,process.env.STRIPE_MODE!=="test")).active)return {kind:'redirect',href:RADAR_ACCESS_PATH+'?next='+encodeURIComponent(next)} as const;
  return {kind:'ready',member} as const;
}
export async function requireCalendarMember(returnTo:unknown='/membros/meu-calendario') {
  const access=await calendarSaveAccess(returnTo);
  if(access.kind==='disabled')notFound();
  if(access.kind==='redirect')redirect(access.href);
  return access.member;
}
export async function calendarSaveState(ids:readonly string[],returnTo:unknown):Promise<CalendarSaveState> {
  try {
    const access=await calendarSaveAccess(returnTo);
    if(access.kind!=='ready')return access;
    const unique=[...new Set(ids)];
    const collections=process.env.RADAR_COLLECTIONS_ENABLED==='true'?(await getSql()`select id,name from radar_calendar_collection where user_id=${access.member.id} and archived_at is null order by lower(name),id`).map(r=>({id:String(r.id),name:String(r.name)})):undefined;
    if(!unique.length)return {kind:'ready',savedIds:[],collections};
    const rows=await getSql()`select opportunity_id from radar_saved_opportunity where user_id=${access.member.id} and removed_at is null and opportunity_id in ${getSql()(unique)}`;
    return {kind:'ready',savedIds:rows.map(r=>String(r.opportunity_id)),collections};
  }catch{return {kind:'unavailable'};}
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
