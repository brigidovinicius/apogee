import { NextResponse, type NextRequest } from "next/server";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { radarAccess } from "@/lib/billing/store";
import { calendarAdultAccess } from "@/lib/members/protection";
import { applicationOrigin } from "@/lib/members/mail";
import { completeGoogleCalendarOAuth } from "@/lib/opportunities/google-calendar-store";
import { syncGoogleCalendar } from "@/lib/opportunities/google-calendar-sync";
import { googleCalendarConfig, GOOGLE_CALENDAR_COOKIE, GOOGLE_CALENDAR_CALLBACK, GOOGLE_CALENDAR_PATH } from "@/lib/opportunities/google-calendar-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const destination = new URL(GOOGLE_CALENDAR_PATH,applicationOrigin());
  let result = "failed";
  try {
    const member = await getMemberFromHeaders(request.headers);
    if (!googleCalendarConfig() || !member || !(await calendarAdultAccess(member.id)) || !(await radarAccess(member.id,process.env.STRIPE_MODE !== "test")).active) result = "access";
    else if (request.nextUrl.searchParams.has("error")) result = "denied";
    else {
      await completeGoogleCalendarOAuth(member.id,request.nextUrl.searchParams.get("state") ?? "",
        request.cookies.get(GOOGLE_CALENDAR_COOKIE)?.value ?? "",request.nextUrl.searchParams.get("code") ?? "");
      result = await syncGoogleCalendar(member.id);
    }
  } catch { /* OAuth credentials and provider responses must never enter logs or URLs. */ }
  destination.searchParams.set("google",result);
  const response = NextResponse.redirect(destination,303);
  response.cookies.set(GOOGLE_CALENDAR_COOKIE,"",{path:GOOGLE_CALENDAR_CALLBACK,maxAge:0,httpOnly:true,sameSite:"lax",secure:destination.protocol==="https:"});
  response.headers.set("Cache-Control","no-store");
  response.headers.set("Referrer-Policy","no-referrer");
  return response;
}
