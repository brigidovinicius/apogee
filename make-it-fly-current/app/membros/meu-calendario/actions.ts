"use server";
import { after } from "next/server";
import { queueGoogleCalendarSync } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { revalidatePath } from "next/cache";
import { requireCalendarMember, saveOpportunity, rotateCalendarToken } from "@/lib/opportunities/personal-calendar";
export async function toggleSaved(id:string,remove:boolean) {
  const member=await requireCalendarMember();await saveOpportunity(member.id,id,remove);
  if (await queueGoogleCalendarSync(member.id)) after(async()=>{await syncGoogleCalendar(member.id).catch(()=>undefined);});
  revalidatePath("/membros/meu-calendario");revalidatePath(`/membros/oportunidades/${id}`);
}
export async function createFeed() {
  const member=await requireCalendarMember();
  try {
    const token=await rotateCalendarToken(member.id);
    return {url:`/meu-calendario/${token}.ics`,error:""};
  } catch { return {url:"",error:"Não foi possível criar o link. Tente novamente."}; }
}
