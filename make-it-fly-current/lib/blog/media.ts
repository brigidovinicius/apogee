import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createPostMedia, getAdminPost, removePostMedia } from "./data";

const BUCKET = "apogee-community-photos";
const MAX_REQUEST = 6 * 1024 * 1024;
const MAX_FILE = 5 * 1024 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;

class MediaError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function settings() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new MediaError(503, "O armazenamento de imagens está indisponível.");
  return { origin: publicOrigin(), key };
}

function publicOrigin() {
  const rawUrl = process.env.SUPABASE_URL || "";
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== "/" || url.search || url.hash || url.port) throw new Error();
    return url.origin;
  } catch { throw new MediaError(503, "O armazenamento de imagens está indisponível."); }
}

export function blogMediaUrl(path: string): string {
  if (!/^blog\/\d+\/[a-f0-9-]{36}\.webp$/.test(path)) throw new Error("Caminho de mídia inválido.");
  return `${publicOrigin()}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function storageRequest(path: string, method: "POST" | "DELETE", body?: Uint8Array) {
  const { origin, key } = settings();
  return fetch(`${origin}/storage/v1/object/${BUCKET}/${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "image/webp", "x-upsert": "false" } : {}) },
    body: body as BodyInit | undefined, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new MediaError(403, "Origem não autorizada.");
}

async function boundedForm(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new MediaError(415, "Envio inválido.");
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && (!/^\d+$/.test(lengthHeader) || Number(lengthHeader) > MAX_REQUEST)) throw new MediaError(413, "O envio excede 6 MB.");
  if (!request.body) throw new MediaError(400, "Selecione uma imagem.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST) { await reader.cancel(); throw new MediaError(413, "O envio excede 6 MB."); }
    chunks.push(value);
  }
  try {
    return await new Request("http://localhost/upload", {
      method: "POST", headers: { "Content-Type": request.headers.get("content-type")! }, body: Buffer.concat(chunks),
    }).formData();
  } catch { throw new MediaError(400, "Não foi possível ler a imagem enviada."); }
}

function cleanText(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max + 1) : "";
}

export async function uploadBlogMedia(request: Request, postId: number): Promise<Response> {
  try {
    sameOrigin(request);
    if (!await getAdminPost(postId)) throw new MediaError(404, "Artigo não encontrado.");
    const form = await boundedForm(request);
    const file = form.get("image");
    const alt = cleanText(form.get("alt"), 160);
    const caption = cleanText(form.get("caption"), 300);
    if (alt.length < 3 || alt.length > 160 || /[\x00-\x1f\x7f]/.test(alt)) throw new MediaError(400, "Descreva a imagem em 3 a 160 caracteres.");
    if (caption.length > 300 || /[\x00-\x1f\x7f]/.test(caption)) throw new MediaError(400, "A legenda pode ter até 300 caracteres.");
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 100 || file.size > MAX_FILE) throw new MediaError(400, "Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.");
    let converted: { data: Buffer; info: { width: number; height: number } } | undefined;
    try {
      const input = Buffer.from(await file.arrayBuffer());
      for (const dimension of [2000, 1600, 1200]) {
        for (const quality of [82, 68, 54]) {
          const attempt = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
            .rotate().resize({ width: dimension, height: dimension, fit: "inside", withoutEnlargement: true })
            .webp({ quality, effort: 4 }).toBuffer({ resolveWithObject: true });
          if (attempt.data.byteLength <= MAX_OUTPUT) { converted = attempt; break; }
        }
        if (converted) break;
      }
    } catch { throw new MediaError(400, "Não foi possível processar esta imagem."); }
    if (!converted) throw new MediaError(413, "A imagem processada ainda excede 2 MB.");
    const id = randomUUID();
    const storagePath = `blog/${postId}/${id}.webp`;
    const uploaded = await storageRequest(storagePath, "POST", new Uint8Array(converted.data));
    if (!uploaded.ok) throw new MediaError(503, "Não foi possível salvar a imagem agora.");
    try {
      const media = await createPostMedia({ id, postId, storagePath, alt, caption: caption || null, width: converted.info.width, height: converted.info.height });
      return Response.json({ media: { ...media, url: blogMediaUrl(storagePath) } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      await storageRequest(storagePath, "DELETE").catch(() => undefined);
      throw error;
    }
  } catch (error) { return mediaErrorResponse(error); }
}

export async function deleteBlogMedia(request: Request, postId: number, mediaId: string): Promise<Response> {
  try {
    sameOrigin(request);
    if (!/^[a-f0-9-]{36}$/.test(mediaId)) throw new MediaError(400, "Imagem inválida.");
    const result = await removePostMedia(postId, mediaId);
    if (result === "missing") throw new MediaError(404, "Imagem não encontrada.");
    if (result === "used") throw new MediaError(409, "Remova a imagem da capa e do texto e salve o artigo antes de excluí-la.");
    const removed = await storageRequest(result.storagePath, "DELETE");
    if (!removed.ok) console.error("Blog media cleanup failed", { postId, mediaId, status: removed.status });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaErrorResponse(error); }
}

function mediaErrorResponse(error: unknown) {
  if (!(error instanceof MediaError)) console.error("Blog media error", error);
  return Response.json({ error: error instanceof MediaError ? error.message : "Não foi possível concluir a operação." }, {
    status: error instanceof MediaError ? error.status : 500,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" },
  });
}
