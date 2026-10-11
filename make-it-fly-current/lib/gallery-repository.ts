import "server-only";
import { getSql } from "./members/db";

export const RETIRED_PHOTO_ID = "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073";

export type StoredPhoto = {
  id: string; author: string; instagram: string; anonymous: boolean;
  width: number; height: number; createdAt: string;
  consentVersion: string; consentedAt: string;
};

export async function listStoredPhotos(offset: number, limit: number): Promise<readonly unknown[]> {
  const sql = getSql();
  // A listagem não lê bytes da imagem nem comprovantes de consentimento.
  return sql`
    SELECT id, author, instagram, anonymous, width, height,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "createdAt"
    FROM public.gallery_photo WHERE id <> ${RETIRED_PHOTO_ID}
    ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function saveStoredPhoto(photo: StoredPhoto, image: Buffer): Promise<void> {
  const sql = getSql();
  // Foto e créditos são gravados juntos: uma falha não deixa arquivos órfãos.
  await sql`
    INSERT INTO public.gallery_photo
      (id, author, instagram, anonymous, width, height, created_at, consent_version, consented_at, image)
    VALUES (${photo.id}, ${photo.author}, ${photo.instagram}, ${photo.anonymous},
      ${photo.width}, ${photo.height}, ${photo.createdAt}, ${photo.consentVersion}, ${photo.consentedAt}, ${image})
  `;
}

export async function readStoredImage(id: string): Promise<Buffer | null> {
  const sql = getSql();
  const rows = await sql<{ image: Buffer }[]>`
    SELECT image FROM public.gallery_photo WHERE id = ${id} AND id <> ${RETIRED_PHOTO_ID} LIMIT 1
  `;
  return rows[0]?.image ?? null;
}

export async function deleteStoredPhoto(id: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM public.gallery_photo WHERE id = ${id}`;
}
