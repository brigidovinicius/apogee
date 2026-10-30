"use server";
import { after } from "next/server";
import { queueGoogleCalendarSync } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { revalidatePath } from "next/cache";
import { requireCalendarMember, saveOpportunity } from "@/lib/opportunities/personal-calendar";
export async function toggleSaved(id:string,remove:boolean) {
  const member=await requireCalendarMember();await saveOpportunity(member.id,id,remove);
  if (await queueGoogleCalendarSync(member.id)) after(async()=>{await syncGoogleCalendar(member.id).catch(()=>undefined);});
  revalidatePath("/membros/meu-calendario");revalidatePath(`/membros/oportunidades/${id}`);
}
