"use server";
import { after } from "next/server";
import { queueGoogleCalendarSync } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { revalidatePath } from "next/cache";
import { requireCalendarMember, calendarSaveAccess, saveOpportunity } from "@/lib/opportunities/personal-calendar";
import type { CalendarSaveResult } from '@/lib/opportunities/calendar-save-types';
import { calendarReturnPath } from '@/lib/opportunities/calendar-navigation';
export async function toggleSaved(id:string,remove:boolean) {
  const member=await requireCalendarMember();await saveOpportunity(member.id,id,remove);
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
  try {access=await calendarSaveAccess(returnTo);}catch{return {ok:false,error:'Não foi possível verificar o acesso. Tente novamente.'};}
  if(access.kind==='disabled')return {ok:false,error:'Agenda temporariamente indisponível.'};
  if(access.kind==='redirect')return {ok:false,redirect:access.href};
  try {await saveOpportunity(access.member.id,id,!saved);}catch{return {ok:false,error:'Não foi possível salvar a alteração. Tente novamente.'};}
  await scheduleSync(access.member.id);
  revalidatePath('/membros/meu-calendario');revalidatePath('/membros/oportunidades/'+id);revalidatePath(calendarReturnPath(returnTo));
  return {ok:true,saved};
}
