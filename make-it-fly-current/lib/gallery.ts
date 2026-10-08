import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import sharp from "sharp";
import { adminAuthorized } from "./admin-auth";
import type { CommunityPhoto } from "./gallery-types";
import { normalizeInstagram } from "./instagram";

const BUCKET = "apogee-community-photos";
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_PUBLIC_BYTES = 3 * 1024 * 1024;
const MAX_ADMIN_BODY_BYTES = 1024;
const MAX_PHOTOS = 24;
const PHOTO_ID_PATTERN = /^[0-9T-Z-]{19,28}-[a-f0-9-]{36}$/;
const RETIRED_PHOTO_IDS = new Set([
  "2026-09-23T01-38-36-784Z-450e2012-5e58-49c6-b59e-cc431e29b073",
]);
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

type GalleryConfig = { url: string; key: string; signingSecret: string };

class GalleryError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function config(): GalleryConfig {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const signingSecret = process.env.APPLICATION_SIGNING_SECRET || "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.port) throw new Error();
    if (!key || signingSecret.length < 32) throw new Error();
    return { url: parsed.origin, key, signingSecret };
  } catch {
    throw new GalleryError(503, "A galeria está indisponível no momento. Tente novamente mais tarde.");
  }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: RESPONSE_HEADERS });
}

function storageHeaders(key: string, contentType?: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
  };
}

async function storageRequest(settings: GalleryConfig, path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`${settings.url}/storage/v1/${path}`, {
    ...init,
    headers: { ...storageHeaders(settings.key), ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  return response;
}

function validatePhoto(value: unknown, settings: GalleryConfig): CommunityPhoto | null {
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
    src: `${settings.url}/storage/v1/object/public/${BUCKET}/photos/${photo.id}.webp`,
    author: photo.author,
    instagram: photo.instagram,
    anonymous,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
  };
}

export async function listCommunityPhotos(request?: Request): Promise<Response> {
  try {
    const settings = config();
    const rawOffset = request ? new URL(request.url).searchParams.get("offset") || "0" : "0";
    const offset = Number(rawOffset);
    if (!/^\d{1,5}$/.test(rawOffset) || !Number.isInteger(offset) || offset > 10_000) throw new GalleryError(400, "Página da galeria inválida.");
    const listed = await storageRequest(settings, `object/list/${BUCKET}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: "entries", limit: MAX_PHOTOS + 1, offset, sortBy: { column: "name", order: "desc" } }),
    });
    if (!listed.ok) throw new GalleryError(503, "Não foi possível carregar as fotos agora.");
    const entries = await listed.json();
    if (!Array.isArray(entries)) throw new GalleryError(503, "Não foi possível carregar as fotos agora.");
    const retiredEntries = entries.filter((entry): entry is { name: string } => {
      if (typeof entry?.name !== "string" || !entry.name.endsWith(".json")) return false;
      return RETIRED_PHOTO_IDS.has(entry.name.slice(0, -5));
    });
    await Promise.all(retiredEntries.flatMap(({ name }) => {
      const id = name.slice(0, -5);
      return [
        storageRequest(settings, `object/${BUCKET}/photos/${id}.webp`, { method: "DELETE" }).catch(() => undefined),
        storageRequest(settings, `object/${BUCKET}/entries/${id}.json`, { method: "DELETE" }).catch(() => undefined),
      ];
    }));
    const photos = await Promise.all(entries.slice(0, MAX_PHOTOS)
      .filter((entry): entry is { name: string } => typeof entry?.name === "string" && /^[0-9T-Z-]{19,28}-[a-f0-9-]{36}\.json$/.test(entry.name))
      .filter((entry) => !RETIRED_PHOTO_IDS.has(entry.name.slice(0, -5)))
      .map(async (entry) => {
        try {
          const response = await storageRequest(settings, `object/${BUCKET}/entries/${entry.name}`, { method: "GET" });
          if (!response.ok) return null;
          return validatePhoto(await response.json(), settings);
        } catch { return null; }
      }));
    return json({ photos: photos.filter(Boolean), nextOffset: entries.length > MAX_PHOTOS ? offset + MAX_PHOTOS : null });
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

const attempts = new Map<string, { count: number; expires: number }>();
function allowUpload(request: Request, settings: GalleryConfig): boolean {
  const provider = process.env.APPLICATION_HOSTING_PROVIDER || (process.env.VERCEL === "1" ? "vercel" : "unknown");
  const header = provider === "vercel" ? "x-vercel-forwarded-for" : provider === "caddy" ? "x-forwarded-for" : null;
  const source = header ? request.headers.get(header) : "local";
  const ip = (source || "unknown").split(",")[0].trim().slice(0, 200);
  const key = createHmac("sha256", settings.signingSecret).update(`gallery:${ip}`).digest("hex");
  const now = Date.now();
  for (const [id, value] of attempts) if (value.expires < now) attempts.delete(id);
  const current = attempts.get(key);
  if (current && current.count >= 10) return false;
  attempts.set(key, { count: (current?.count || 0) + 1, expires: current?.expires || now + 10 * 60_000 });
  return true;
}

async function boundedFormData(request: Request): Promise<FormData> {
  if (!request.body) throw new GalleryError(400, "Selecione uma foto antes de enviar.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new GalleryError(413, "A foto preparada excede o limite de 3 MB.");
    }
    chunks.push(value);
  }
  try {
    return await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type") || "" },
      body: Buffer.concat(chunks),
    }).formData();
  } catch {
    throw new GalleryError(400, "O envio está incompleto. Selecione a foto novamente.");
  }
}

export async function uploadCommunityPhoto(request: Request): Promise<Response> {
  try {
    const settings = config();
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) throw new GalleryError(403, "Origem do envio não autorizada.");
    const lengthHeader = request.headers.get("content-length");
    const length = lengthHeader === null ? null : Number(lengthHeader);
    if (length !== null && (!Number.isFinite(length) || length < 1 || length > MAX_UPLOAD_BYTES)) throw new GalleryError(413, "A foto preparada excede o limite de 3 MB.");
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new GalleryError(415, "Formato de envio inválido.");
    if (!allowUpload(request, settings)) throw new GalleryError(429, "Muitas fotos enviadas em sequência. Tente novamente em alguns minutos.");
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
    const photoPath = `object/${BUCKET}/photos/${id}.webp`;
    const createdAt = new Date().toISOString();
    const photo = { id, author, instagram, anonymous, width, height, createdAt, consentVersion: "2026-09-22", consentedAt: createdAt };
    const uploaded = await storageRequest(settings, photoPath, { method: "POST", headers: { "Content-Type": "image/webp", "x-upsert": "false" }, body: new Uint8Array(output) });
    if (!uploaded.ok) throw new GalleryError(503, "Não foi possível salvar a foto agora. Tente novamente.");
    const savedCredit = await storageRequest(settings, `object/${BUCKET}/entries/${id}.json`, { method: "POST", headers: { "Content-Type": "application/json", "x-upsert": "false" }, body: JSON.stringify(photo) });
    if (!savedCredit.ok) {
      await storageRequest(settings, photoPath, { method: "DELETE" }).catch(() => undefined);
      throw new GalleryError(503, "Não foi possível salvar os créditos. Tente novamente.");
    }
    return json({ photo: validatePhoto(photo, settings) }, 201);
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

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ADMIN_BODY_BYTES) {
        await reader.cancel();
        throw new GalleryError(413, "Solicitação excede o tamanho permitido.");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof GalleryError) throw error;
    throw new GalleryError(400, "Solicitação inválida.");
  } finally {
    reader.releaseLock();
  }
}

export async function manageCommunityPhotos(
  request: Request,
  context: GalleryAdminContext = {},
): Promise<Response> {
  try {
    if (!galleryAdminAuthorized(request, context)) return privateJson({ error: "Não encontrado." }, 404);

    if (request.method === "GET") return listCommunityPhotos(request);
    if (request.method !== "DELETE") return privateJson({ error: "Método não permitido." }, 405);

    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return privateJson({ error: "Origem não autorizada." }, 403);

    const body = await readAdminDeleteBody(request);
    const validShape = Boolean(body && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 1 && "id" in body);
    const id = validShape && typeof (body as { id?: unknown }).id === "string" ? (body as { id: string }).id : "";
    if (!PHOTO_ID_PATTERN.test(id)) return privateJson({ error: "Foto inválida." }, 400);

    const settings = config();
    const [photoDeleted, entryDeleted] = await Promise.all([
      storageRequest(settings, `object/${BUCKET}/photos/${id}.webp`, { method: "DELETE" }),
      storageRequest(settings, `object/${BUCKET}/entries/${id}.json`, { method: "DELETE" }),
    ]);
    const accepted = (response: Response) => response.ok || response.status === 404;
    if (!accepted(photoDeleted) || !accepted(entryDeleted)) {
      return privateJson({ error: "Não foi possível excluir a foto agora. Tente novamente." }, 503);
    }
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
