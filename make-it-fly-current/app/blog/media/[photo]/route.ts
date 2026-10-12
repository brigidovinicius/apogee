import { getPostMediaImage } from "@/lib/blog/data";
import { getMemberFromHeaders } from "@/lib/members/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ photo: string }> }) {
  const filename = (await context.params).photo;
  if (!/^[a-f0-9-]{36}\.webp$/.test(filename)) return new Response(null, { status: 404 });
  const id = filename.slice(0, -5);
  let image = await getPostMediaImage(id, false);
  if (!image) {
    const member = await getMemberFromHeaders(request.headers);
    if (member?.role !== "admin") return new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    image = await getPostMediaImage(id, true);
  }
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image), {
    headers: {
      "Content-Type": "image/webp", "Content-Length": String(image.byteLength),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    },
  });
}
