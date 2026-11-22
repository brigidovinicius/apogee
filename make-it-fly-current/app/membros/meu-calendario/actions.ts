"use server";
import { after } from "next/server";
import { queueGoogleCalendarSync } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireCalendarMember, calendarSaveAccess, saveOpportunity } from "@/lib/opportunities/personal-calendar";
import type { CalendarSaveResult } from '@/lib/opportunities/calendar-save-types';
import { calendarReturnPath, calendarSavePath } from '@/lib/opportunities/calendar-navigation';
import { radarAmplitudeConfig, radarAmplitudePreference, radarAmplitudePrivacySignal, scheduleRadarAmplitudeEvent } from "@/lib/radar-amplitude";

async function saveFromWeb(memberId: string, id: string, remove: boolean) {
  const grant = !remove && radarAmplitudeConfig() && !radarAmplitudePrivacySignal(await headers())
    ? await radarAmplitudePreference(memberId).catch(() => null)
    : null;
  const created = await saveOpportunity(memberId, id, remove);
  if (created && grant) scheduleRadarAmplitudeEvent(memberId, grant, "radar_opportunity_saved");
}

export async function toggleSaved(id:string,remove:boolean) {
  const member=await requireCalendarMember();await saveFromWeb(member.id,id,remove);
  await scheduleSync(member.id);
  revalidatePath("/membros/meu-calendario");revalidatePath(`/membros/oportunidades/${id}`);
}
async function scheduleSync(userId:string) {
  try {if(await queueGoogleCalendarSync(userId))after(async()=>{await syncGoogleCalendar(userId).catch(()=>undefined);});}
  catch { console.error('[calendar] sincronização pendente após salvar'); }
}
export async function saveOpportunityFromCard(id:string,saved:boolean,returnTo:string):Promise<CalendarSaveResult> {
  if(typeof saved!=='boolean'||typeof id!=='string'||!/^radar-[a-zA-Z0-9_-]{1,194}$/.test(id))return {ok:false,error:'Oportunidade inválida.'};
  let access;
  try {access=await calendarSaveAccess(calendarSavePath(id,calendarReturnPath(returnTo)));}catch{return {ok:false,error:'Não foi possível verificar o acesso. Tente novamente.'};}
  if(access.kind==='disabled')return {ok:false,error:'Agenda temporariamente indisponível.'};
  if(access.kind==='redirect')return {ok:false,redirect:access.href};
  try {await saveFromWeb(access.member.id,id,!saved);}catch{return {ok:false,error:'Não foi possível salvar a alteração. Tente novamente.'};}
  await scheduleSync(access.member.id);
  revalidatePath('/membros/meu-calendario');revalidatePath('/membros/oportunidades/'+id);revalidatePath(calendarReturnPath(returnTo));
  return {ok:true,saved};
}
