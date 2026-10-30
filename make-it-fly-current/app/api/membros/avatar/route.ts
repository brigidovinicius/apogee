import { AvatarError, boundedAvatarForm, checkAvatarOrigin, convertAvatar, removeAvatar, saveAvatar } from "@/lib/members/avatar";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { consumeRateLimit } from "@/lib/members/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };

function failure(error: unknown): Response {
  if (!(error instanceof AvatarError)) console.error("[membros] erro ao alterar foto", error);
  return Response.json({ error: error instanceof AvatarError ? error.message : "Não foi possível alterar a foto agora." }, {
    status: error instanceof AvatarError ? error.status : 500,
    headers,
  });
}

export async function POST(request: Request): Promise<Response> {
  const member = await getMemberFromHeaders(request.headers);
  if (!member) return Response.json({ error: "Entre para alterar sua foto." }, { status: 401, headers });
  if(!(await adultAccess(member.id)))return Response.json({error:"Conclua a verificação da conta antes de enviar uma foto."},{status:403,headers});
  try {
    checkAvatarOrigin(request);
    if (!await consumeRateLimit(`avatar:${member.id}`, 10, 3600)) {
      throw new AvatarError(429, "Muitos envios de foto. Aguarde um pouco e tente de novo.");
    }
    const form = await boundedAvatarForm(request);
    const image = await convertAvatar(form.get("image"));
    const url = await saveAvatar(member.id, image);
    return Response.json({ url }, { status: 201, headers });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request): Promise<Response> {
  const member = await getMemberFromHeaders(request.headers);
  if (!member) return Response.json({ error: "Entre para alterar sua foto." }, { status: 401, headers });
  try {
    checkAvatarOrigin(request);
    await removeAvatar(member.id);
    return Response.json({ ok: true }, { headers });
  } catch (error) { return failure(error); }
}
