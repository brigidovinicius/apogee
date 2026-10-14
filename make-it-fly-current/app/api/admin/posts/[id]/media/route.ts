import { deleteBlogMedia, uploadBlogMedia } from "@/lib/blog/media";
import { getMemberFromHeaders } from "@/lib/members/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorized(request: Request) {
  const member = await getMemberFromHeaders(request.headers);
  return member?.role === "admin";
}

function idFrom(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized(request)) return Response.json({ error: "Acesso negado." }, { status: 403 });
  const id = idFrom((await context.params).id);
  if (!id) return Response.json({ error: "Artigo inválido." }, { status: 400 });
  return uploadBlogMedia(request, id);
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!await authorized(request)) return Response.json({ error: "Acesso negado." }, { status: 403 });
  const id = idFrom((await context.params).id);
  if (!id) return Response.json({ error: "Artigo inválido." }, { status: 400 });
  const mediaId = new URL(request.url).searchParams.get("mediaId") || "";
  return deleteBlogMedia(request, id, mediaId);
}
