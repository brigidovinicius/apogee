import { timingSafeEqual } from "node:crypto";
import { syncDueGoogleCalendars } from "@/lib/opportunities/google-calendar-sync";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function POST(request: Request) {
  const secret = process.env.GOOGLE_CALENDAR_SYNC_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const expected = "Bearer "+secret;
  if (!secret || secret.length<32 || Buffer.byteLength(authorization)!==Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(authorization),Buffer.from(expected))) return new Response(null,{status:401});
  try {
    return Response.json({processed:await syncDueGoogleCalendars()},{headers:{"Cache-Control":"no-store"}});
  } catch {
    return Response.json({error:"Sincronização temporariamente indisponível"},{status:503});
  }
}
