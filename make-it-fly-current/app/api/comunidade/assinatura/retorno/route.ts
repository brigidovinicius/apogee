import { NextResponse } from "next/server";
import { applicationOrigin } from "@/lib/members/mail";
import { refreshGuestSession, GUEST_CHECKOUT_COOKIE } from "@/lib/billing/community-guest-store";
import { getSql } from "@/lib/members/db";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id") ?? "";
  const response = NextResponse.redirect(new URL("/comunidade/ativar", applicationOrigin()), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  try {
    const [row] = await getSql()`select id from community_guest_checkout where session_id=${sessionId}`;
    if (row && await refreshGuestSession(sessionId)) response.cookies.set(GUEST_CHECKOUT_COOKIE, String(row.id), { httpOnly: true, secure: new URL(applicationOrigin()).protocol === "https:", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
  } catch { /* Signed webhooks and verified-email recovery can finish this later. */ }
  return response;
}
