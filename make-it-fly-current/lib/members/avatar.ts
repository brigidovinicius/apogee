import "server-only";
import { RequestBodyError, readRequestBody, UPLOAD_BODY_TIMEOUT_MS } from "@/lib/request-body";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { getDb } from "./db";
import { memberAvatar, user } from "./schema";

const MAX_REQUEST = 6 * 1024 * 1024;
const MAX_FILE = 5 * 1024 * 1024;
const MAX_OUTPUT = 256 * 1024;
const MIME_FORMAT: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export class AvatarError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function checkAvatarOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new AvatarError(403, "Origem não autorizada.");
}

export async function boundedAvatarForm(request: Request): Promise<FormData> {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) {
    throw new AvatarError(415, "Envio inválido.");
  }
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST)) {
    throw new AvatarError(413, "O envio excede 6 MB.");
  }
  if (!request.body) throw new AvatarError(400, "Selecione uma foto.");
  try {
    const body = await readRequestBody(request, MAX_REQUEST, UPLOAD_BODY_TIMEOUT_MS);
    return await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type")! },
      body,
    }).formData();
  } catch (error) {
    if (error instanceof RequestBodyError) throw new AvatarError(error.status, error.status === 413 ? "O envio excede 6 MB." : error.message);
    throw new AvatarError(400, "Não foi possível ler a foto enviada.");
  }
}

export async function convertAvatar(file: FormDataEntryValue | null): Promise<Buffer> {
  if (!(file instanceof File) || !MIME_FORMAT[file.type] || file.size < 100 || file.size > MAX_FILE) {
    throw new AvatarError(400, "Escolha uma foto JPEG, PNG ou WebP de até 5 MB.");
  }
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(input, { limitInputPixels: 20_000_000, failOn: "error" }).metadata();
    if (metadata.format !== MIME_FORMAT[file.type] || !metadata.width || !metadata.height) {
      throw new AvatarError(400, "O formato da foto não corresponde ao arquivo enviado.");
    }
    for (const dimension of [512, 384]) {
      for (const quality of [80, 65, 50]) {
        const output = await sharp(input, { limitInputPixels: 20_000_000, failOn: "error" })
          .rotate()
          .resize({ width: dimension, height: dimension, fit: "cover", position: "attention", withoutEnlargement: true })
          .webp({ quality, effort: 4 })
          .toBuffer();
        if (output.byteLength <= MAX_OUTPUT) return output;
      }
    }
  } catch (error) {
    if (error instanceof AvatarError) throw error;
    throw new AvatarError(400, "Não foi possível processar esta foto.");
  }
  throw new AvatarError(413, "A foto processada ainda excede 256 KB.");
}

export async function saveAvatar(userId: string, image: Buffer): Promise<string> {
  const url = `/api/membros/avatar/${encodeURIComponent(userId)}?v=${randomUUID()}`;
  await getDb().transaction(async (tx) => {
    await tx.insert(memberAvatar).values({ userId, image }).onConflictDoUpdate({
      target: memberAvatar.userId,
      set: { image, updatedAt: sql`now()` },
    });
    await tx.update(user).set({ image: url, updatedAt: sql`now()` }).where(eq(user.id, userId));
  });
  return url;
}

export async function removeAvatar(userId: string): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.delete(memberAvatar).where(eq(memberAvatar.userId, userId));
    await tx.update(user).set({ image: null, updatedAt: sql`now()` }).where(eq(user.id, userId));
  });
}

export async function readAvatar(userId: string): Promise<Buffer | null> {
  const [record] = await getDb().select({ image: memberAvatar.image })
    .from(memberAvatar).where(eq(memberAvatar.userId, userId)).limit(1);
  return record?.image ?? null;
}
