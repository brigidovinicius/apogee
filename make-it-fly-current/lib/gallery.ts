import "server-only";
import { RequestBodyError, readRequestBody, UPLOAD_BODY_TIMEOUT_MS } from "@/lib/request-body";

import { createHmac, randomUUID } from "node:crypto";
import sharp from "sharp";
import { adminAuthorized } from "./admin-auth";
import type { CommunityPhoto } from "./gallery-types";
import { normalizeInstagram } from "./instagram";
import { GALLERY_PAGE_SIZE } from "./gallery-pagination";
import { deleteStoredPhoto, listStoredPhotos, readStoredImage, saveStoredPhoto } from "./gallery-repository";

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_PUBLIC_BYTES = 3 * 1024 * 1024;
const MAX_ADMIN_BODY_BYTES = 1024;
const MAX_PHOTOS = GALLERY_PAGE_SIZE;
const PHOTO_ID_PATTERN = /^[0-9T-Z-]{19,28}-[a-f0-9-]{36}$/;
const RETIRED_PHOTO_IDS = new Set([
  "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073",
]);
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

class GalleryError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function uploadSigningSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || "";
  if (secret.length < 32) throw new GalleryError(503, "O envio de fotos está indisponível no momento.");
  return secret;
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: RESPONSE_HEADERS });
}

function validatePhoto(value: unknown): CommunityPhoto | null {
  if (!value || typeof value !== "object") return null;
  const photo = value as Record<string, unknown>;
  if (typeof photo.id !== "string" || !PHOTO_ID_PATTERN.test(photo.id)) return null;
  const anonymous = photo.anonymous === true;
  if (anonymous) {
    if (photo.author !== "Anônimo" || photo.instagram !== "") return null;
  } else {
    if (typeof photo.author !== "string" || photo.author.length < 2 || photo.author.length > 80) return null;
    if (typeof photo.instagram !== "string" || normalizeInstagram(photo.instagram) !== photo.instagram) return null;
  }
  if (typeof photo.width !== "number" || typeof photo.height !== "number" || photo.width < 1 || photo.height < 1) return null;
  if (typeof photo.createdAt !== "string" || Number.isNaN(Date.parse(photo.createdAt))) return null;
  return {
    id: photo.id,
    src: `/galeria/fotos/${photo.id}.webp`,
    author: photo.author,
    instagram: photo.instagram,
    anonymous,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
  };
}

// Todas as leituras são livres de alterações, inclusive o endpoint público.
export async function listCommunityPhotos(request?: Request): Promise<Response> {
  try {
    const rawOffset = request ? new URL(request.url).searchParams.get("offset") || "0" : "0";
    const offset = Number(rawOffset);
    if (!/^\d{1,5}$/.test(rawOffset) || !Number.isInteger(offset) || offset > 10_000) throw new GalleryError(400, "Página da galeria inválida.");
    const entries = await listStoredPhotos(offset, MAX_PHOTOS + 1);
    const photos = entries.slice(0, MAX_PHOTOS).map(validatePhoto)
      .filter((photo): photo is CommunityPhoto => photo !== null && !RETIRED_PHOTO_IDS.has(photo.id));
    return json({ photos, nextOffset: entries.length > MAX_PHOTOS ? offset + MAX_PHOTOS : null });
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

export async function communityPhotoImage(filename: string): Promise<Response> {
  const id = filename.endsWith(".webp") ? filename.slice(0, -5) : "";
  const missing = () => new Response(null, { status: 404, headers: { ...RESPONSE_HEADERS, "X-Robots-Tag": "noindex" } });
  if (!PHOTO_ID_PATTERN.test(id) || RETIRED_PHOTO_IDS.has(id)) return missing();
  try {
    const image = await readStoredImage(id);
    if (!image) return missing();
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/webp", "Content-Length": String(image.byteLength),
        "Cache-Control": "public, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response(null, { status: 503, headers: { ...RESPONSE_HEADERS, "X-Robots-Tag": "noindex", "Retry-After": "60" } });
  }
}

const attempts = new Map<string, { count: number; expires: number }>();
function allowUpload(request: Request, signingSecret: string): boolean {
  const provider = process.env.APPLICATION_HOSTING_PROVIDER || (process.env.VERCEL === "1" ? "vercel" : "unknown");
  const header = provider === "vercel" ? "x-vercel-forwarded-for" : provider === "caddy" ? "x-forwarded-for" : null;
  const source = header ? request.headers.get(header) : "local";
  const ip = (source || "unknown").split(",")[0].trim().slice(0, 200);
  const key = createHmac("sha256", signingSecret).update(`gallery:${ip}`).digest("hex");
  const now = Date.now();
  for (const [id, value] of attempts) if (value.expires < now) attempts.delete(id);
  const current = attempts.get(key);
  if (current && current.count >= 10) return false;
  attempts.set(key, { count: (current?.count || 0) + 1, expires: current?.expires || now + 10 * 60_000 });
  return true;
}

async function boundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new GalleryError(400, "Selecione uma foto antes de enviar.");
  try {
    const body = await readRequestBody(request, MAX_UPLOAD_BYTES, UPLOAD_BODY_TIMEOUT_MS);
    return await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body,
    }).formData();
  } catch (error) {
    if (error instanceof RequestBodyError) throw new GalleryError(error.status, error.message);
    throw new GalleryError(400, "O envio está incompleto. Selecione a foto novamente.");
  }
}

export async function uploadCommunityPhoto(request: Request): Promise<Response> {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) throw new GalleryError(403, "Origem do envio não autorizada.");
    const lengthHeader = request.headers.get("content-length");
    const length = lengthHeader === null ? null : Number(lengthHeader);
    if (length !== null && (!Number.isFinite(length) || length < 1 || length > MAX_UPLOAD_BYTES)) throw new GalleryError(413, "A foto preparada excede o limite de 3 MB.");
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new GalleryError(415, "Formato de envio inválido.");
    if (!allowUpload(request, uploadSigningSecret())) throw new GalleryError(429, "Muitas fotos enviadas em sequência. Tente novamente em alguns minutos.");
    const form = await boundedFormData(request);
    const file = form.get("photo");
    const rawAuthor = form.get("author");
    const rawInstagram = form.get("instagram");
    const anonymous = form.get("anonymous") === "true";
    const consent = form.get("consent");
    const author = anonymous ? "Anônimo" : typeof rawAuthor === "string" ? rawAuthor.trim().replace(/\s+/g, " ") : "";
    const instagram = anonymous ? "" : typeof rawInstagram === "string" ? normalizeInstagram(rawInstagram) : null;
    if (!anonymous && (author.length < 2 || author.length > 80 || /[\x00-\x1f\x7f]/.test(author))) throw new GalleryError(400, "Informe seu nome com até 80 caracteres.");
    if (instagram === null) throw new GalleryError(400, "Use @usuario ou o link do seu perfil do Instagram.");
    if (consent !== "true") throw new GalleryError(400, "Confirme a autorização para publicar a foto.");
    if (!(file instanceof File) || !["image/webp", "image/jpeg"].includes(file.type) || file.size < 100 || file.size > MAX_UPLOAD_BYTES) throw new GalleryError(400, "Selecione uma foto JPEG ou WebP válida.");

    const input = Buffer.from(await file.arrayBuffer());
    let converted: { data: Buffer; info: { width: number; height: number } } | undefined;
    try {
      for (const dimension of [2400, 1800, 1400, 1100]) {
        for (const quality of [82, 68, 54]) {
          const attempt = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
            .rotate()
            .resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true })
            .webp({ quality, effort: 4 })
            .toBuffer({ resolveWithObject: true });
          if (attempt.data.byteLength <= MAX_PUBLIC_BYTES) {
            converted = attempt;
            break;
          }
        }
        if (converted) break;
      }
    } catch {
      throw new GalleryError(400, "Não foi possível processar esta imagem. Escolha outro arquivo.");
    }
    if (!converted) throw new GalleryError(413, "A foto ainda está grande demais. Tente outra imagem.");
    const { data: output, info: { width, height } } = converted;
    const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const photo = { id, author, instagram, anonymous, width, height, createdAt, consentVersion: "2026-09-22", consentedAt: createdAt };
    await saveStoredPhoto(photo, output);
    return json({ photo: validatePhoto(photo) }, 201);
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

type GalleryAdminContext = { memberRole?: "member" | "admin" | null };

function galleryAdminAuthorized(request: Request, context: GalleryAdminContext): boolean {
  if (context.memberRole === "admin") return true;
  return adminAuthorized(request);
}

function privateJson(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      ...RESPONSE_HEADERS,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}

async function readAdminDeleteBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new GalleryError(415, "Formato de envio inválido.");
  }
  const lengthHeader = request.headers.get("content-length");
  const length = lengthHeader === null ? null : Number(lengthHeader);
  if (length !== null && (!Number.isFinite(length) || length < 1)) throw new GalleryError(400, "Solicitação inválida.");
  if (length !== null && length > MAX_ADMIN_BODY_BYTES) throw new GalleryError(413, "Solicitação excede o tamanho permitido.");
  if (!request.body) throw new GalleryError(400, "Solicitação inválida.");

  try {
    return JSON.parse((await readRequestBody(request, MAX_ADMIN_BODY_BYTES)).toString("utf8"));
  } catch (error) {
    if (error instanceof RequestBodyError) throw new GalleryError(error.status, error.message);
    throw new GalleryError(400, "Solicitação inválida.");
  }
}

export async function manageCommunityPhotos(
  request: Request,
  context: GalleryAdminContext = {},
): Promise<Response> {
  try {
    if (!galleryAdminAuthorized(request, context)) return privateJson({ error: "Não encontrado." }, 404);

    if (request.method === "GET") {
      const response = await listCommunityPhotos(request);
      return privateJson(await response.json(), response.status);
    }
    if (request.method !== "DELETE") return privateJson({ error: "Método não permitido." }, 405);

    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateJson({ error: "Origem não autorizada." }, 403);

    const body = await readAdminDeleteBody(request);
    const validShape = Boolean(body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 && "id" in body);
    const id = validShape && typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : "";
    if (!PHOTO_ID_PATTERN.test(id)) return privateJson({ error: "Foto inválida." }, 400);

    await deleteStoredPhoto(id);
    return privateJson({ deleted: id });
  } catch (error) {
    if (error instanceof GalleryError) return privateJson({ error: error.message }, error.status);
    return privateJson({ error: "Não foi possível concluir agora. Tente novamente." }, 503);
  }
}

function galleryErrorResponse(error: unknown): Response {
  if (error instanceof GalleryError) return json({ error: error.message }, error.status);
  return json({ error: "Não foi possível concluir agora. Tente novamente." }, 503);
}
