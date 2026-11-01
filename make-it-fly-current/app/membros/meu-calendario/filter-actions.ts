'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCalendarMember } from '@/lib/opportunities/personal-calendar';
import { calendarFilterQuery } from '@/lib/opportunities/calendar-filters';
import { storeCalendarFilter, removeCalendarFilter } from '@/lib/opportunities/saved-calendar-filters';
export async function saveCalendarFilter(data:FormData) {
  const member=await requireCalendarMember();
  const query=typeof data.get('filters')==='string'?String(data.get('filters')):'';
  let error=false;
  try { await storeCalendarFilter(member.id,data.get('name'),query); } catch { error=true; }
  revalidatePath('/membros/meu-calendario');
  const target=new URLSearchParams(calendarFilterQuery(new URLSearchParams(query.slice(0,2048))));
  target.set('catalogo','1');target.set('filtro',error?'erro':'salvo');
  redirect('/membros/meu-calendario?'+target.toString());
}
export async function deleteCalendarFilter(data:FormData) {
  const member=await requireCalendarMember();
  await removeCalendarFilter(member.id,data.get('id'));
  revalidatePath('/membros/meu-calendario');
}
