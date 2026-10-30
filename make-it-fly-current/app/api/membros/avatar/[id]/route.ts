import { readAvatar } from "@/lib/members/avatar";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const member = await getMemberFromHeaders(request.headers);
  if (!member) return new Response(null, { status: 404 });
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return new Response(null, { status: 404 });
  if(id!==member.id && (!(await adultAccess(member.id)) || !(await adultAccess(id))))return new Response(null,{status:404});
  const image = await readAvatar(id);
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(image.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
