"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCalendarMember } from "@/lib/opportunities/personal-calendar";
import { beginGoogleCalendarOAuth, disconnectGoogleCalendar } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { GOOGLE_CALENDAR_COOKIE, GOOGLE_CALENDAR_RETURN_COOKIE, GOOGLE_CALENDAR_CALLBACK, GOOGLE_CALENDAR_PATH } from "@/lib/opportunities/google-calendar-config";
import { googleCalendarReturnPath, googleCalendarReviewPath } from "@/lib/opportunities/google-calendar-navigation";
import { applicationOrigin } from "@/lib/members/mail";
import { getCurrentMember } from "@/lib/members/dal";
import { calendarAdultAccess } from "@/lib/members/protection";

export async function connectGoogleCalendarAction(form?: FormData) {
  const returnTo=googleCalendarReturnPath(form?.get('next'));
  const member = await requireCalendarMember(returnTo);
  if (!(await calendarAdultAccess(member.id))) redirect(googleCalendarReviewPath(returnTo));
  const result = await beginGoogleCalendarOAuth(member.id);
  const jar=await cookies();
  const options={
    httpOnly:true,secure:applicationOrigin().startsWith("https:"),sameSite:"lax",
    path:GOOGLE_CALENDAR_CALLBACK,maxAge:600,
  } as const;
  jar.set(GOOGLE_CALENDAR_COOKIE,result.state,options);
  jar.set(GOOGLE_CALENDAR_RETURN_COOKIE,returnTo,options);
  redirect(result.url);
}
export async function disconnectGoogleCalendarAction() {
  const member = await getCurrentMember();
  if (!member) redirect('/membros/entrar?next=%2Fmembros%2Fprotecao');
  await disconnectGoogleCalendar(member.id);
  revalidatePath(GOOGLE_CALENDAR_PATH);
  revalidatePath('/membros/protecao');
}
export async function syncGoogleCalendarAction(form?: FormData): Promise<void> {
  const returnTo=googleCalendarReturnPath(form?.get('next'));
  const member = await requireCalendarMember(returnTo);
  const result = await syncGoogleCalendar(member.id,{manual:true});
  revalidatePath(GOOGLE_CALENDAR_PATH);
  const destination=new URL(returnTo,applicationOrigin());
  destination.searchParams.set('google',result);
  redirect(destination.pathname+destination.search+destination.hash);
}
