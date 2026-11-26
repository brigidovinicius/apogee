"use server";

import { WORKSHOP_REFERENCES_PATH } from "@/lib/eventos/catalogo";
import { PHOTO_ID, albumConfig, albumIdentity, albumWorker, canAccessAlbum } from "@/lib/eventos/fotos";
import { isFaceRegion, type FaceRegion } from "@/lib/eventos/regiao";
import { requireAdmin } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";

type Result = { box: FaceRegion | null } | { error: string };
const unavailable = "Não foi possível acessar a marcação. Tente novamente.";

async function reference(
  memberId: string,
  photoId: string,
  method: "GET" | "PUT" | "DELETE",
  box?: FaceRegion,
): Promise<Result> {
  await requireAdmin(WORKSHOP_REFERENCES_PATH);
  const config = albumConfig();
  if (!config?.selfie || typeof memberId !== "string" || typeof photoId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(memberId) || !PHOTO_ID.test(photoId) || !canAccessAlbum(memberId, config)) {
    return { error: unavailable };
  }

  try {
    if (!await adultAccess(memberId)) return { error: "A conta selecionada precisa estar autorizada a usar a busca." };
    const response = await albumWorker(config, `/references/${photoId}`, {
      method,
      headers: { ...albumIdentity(config, memberId), ...(box && { "Content-Type": "application/json" }) },
      ...(box && { body: JSON.stringify(box) }),
    });
    if (response.status === 409) return { error: "Confira se a foto está disponível e se o aceite do participante continua ativo." };
    if (response.status === 429) return { error: "O álbum está ocupado. Aguarde um instante e tente novamente." };
    if (!response.ok) return { error: unavailable };
    const payload = await response.json();
    return payload.box === null || isFaceRegion(payload.box) ? { box: payload.box } : { error: unavailable };
  } catch {
    return { error: unavailable };
  }
}

export async function loadReference(memberId: string, photoId: string) {
  return reference(memberId, photoId, "GET");
}

export async function saveReference(memberId: string, photoId: string, box: FaceRegion, confirmed: boolean) {
  if (!isFaceRegion(box) || confirmed !== true) return { error: "Marque a região do rosto e confirme quem aparece nela." };
  return reference(memberId, photoId, "PUT", box);
}

export async function deleteReference(memberId: string, photoId: string) {
  return reference(memberId, photoId, "DELETE");
}
