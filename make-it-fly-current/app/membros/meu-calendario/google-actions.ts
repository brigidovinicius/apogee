"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCalendarMember } from "@/lib/opportunities/personal-calendar";
import { beginGoogleCalendarOAuth, disconnectGoogleCalendar } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { GOOGLE_CALENDAR_COOKIE, GOOGLE_CALENDAR_CALLBACK, GOOGLE_CALENDAR_PATH } from "@/lib/opportunities/google-calendar-config";
import { applicationOrigin } from "@/lib/members/mail";

export async function connectGoogleCalendarAction() {
  const member = await requireCalendarMember();
  const result = await beginGoogleCalendarOAuth(member.id);
  (await cookies()).set(GOOGLE_CALENDAR_COOKIE,result.state,{
    httpOnly:true,secure:applicationOrigin().startsWith("https:"),sameSite:"lax",
    path:GOOGLE_CALENDAR_CALLBACK,maxAge:600,
  });
  redirect(result.url);
}
export async function disconnectGoogleCalendarAction() {
  const member = await requireCalendarMember();
  await disconnectGoogleCalendar(member.id);
  revalidatePath(GOOGLE_CALENDAR_PATH);
}
export async function syncGoogleCalendarAction(): Promise<void> {
  const member = await requireCalendarMember();
  const result = await syncGoogleCalendar(member.id);
  revalidatePath(GOOGLE_CALENDAR_PATH);
  redirect(GOOGLE_CALENDAR_PATH+"?google="+result);
}
