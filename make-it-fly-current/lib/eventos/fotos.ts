import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { PHOTO_API, WORKSHOP, type AlbumPhoto } from "./catalogo";

export const PRIVATE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export const PHOTO_ID = /^[a-f0-9]{32}$/;
const GRANT_SECONDS = 15 * 60;

export function albumConfig() {
  if (process.env.APOGEE_WORKSHOP_MEDIA_ENABLED !== "true") return null;
  const base = process.env.APOGEE_WORKSHOP_MEDIA_URL ?? "";
  const secret = process.env.ALBUM_SECRET ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost|photos):8786$/.test(base) ||
      !/^[a-zA-Z0-9_-]{32,128}$/.test(secret)) return null;
  const allowed = new Set((process.env.APOGEE_WORKSHOP_MEDIA_MEMBER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean));
  if (!allowed.size) return null;
  return { base: `${base}/${WORKSHOP.slug}`, secret, allowed, browse: process.env.APOGEE_WORKSHOP_MEDIA_BROWSE === "true" };
}

type AlbumConfig = NonNullable<ReturnType<typeof albumConfig>>;

export async function canAccessAlbum(memberId: string, config: AlbumConfig) {
  return config.allowed.has(memberId) && await adultAccess(memberId);
}

export async function albumMember(headers: Headers, config: AlbumConfig) {
  if (!getSessionCookie(headers)) return null;
  const member = await getMemberFromHeaders(headers);
  return member && await canAccessAlbum(member.id, config) ? member : null;
}

export function albumWorker(config: AlbumConfig, path: string, init?: RequestInit, timeout = 25_000) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${config.secret}`);
  return fetch(`${config.base}${path}`, {
    ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout),
  });
}

export function actorKey(config: AlbumConfig, id: string) {
  return createHmac("sha256", config.secret).update(JSON.stringify(["actor", WORKSHOP.slug, id])).digest("hex");
}

function sign(config: AlbumConfig, memberId: string, id: string, expires: number) {
  return createHmac("sha256", config.secret)
    .update(JSON.stringify(["media", WORKSHOP.slug, memberId, id, expires])).digest("hex");
}

export function validPhotoGrant(config: AlbumConfig, memberId: string, id: string, grant: string | null) {
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(grant ?? "");
  if (!match) return false;
  const expires = Number(match[1]);
  const now = Math.floor(Date.now() / 1000);
  return expires > now && expires <= now + GRANT_SECONDS &&
    timingSafeEqual(Buffer.from(match[2], "hex"), Buffer.from(sign(config, memberId, id, expires), "hex"));
}

export function photoLinks(ids: unknown, config: AlbumConfig, memberId: string): AlbumPhoto[] {
  if (!Array.isArray(ids) || ids.length > 400 || !ids.every(id => typeof id === "string" && PHOTO_ID.test(id))) {
    throw new Error("Lista de fotos inválida.");
  }
  const expires = Math.floor(Date.now() / 1000) + GRANT_SECONDS;
  return [...new Set<string>(ids)].map(id => {
    const grant = config.browse ? "" : `?grant=${expires}.${sign(config, memberId, id, expires)}`;
    return { id, thumbnail: `${PHOTO_API}/${id}/thumb${grant}`, download: `${PHOTO_API}/${id}/download${grant}` };
  });
}

export async function readAlbum(config: AlbumConfig, memberId: string) {
  const response = await albumWorker(config, "/photos");
  if (!response.ok) return null;
  const index: { ids: unknown; expires: number; video: boolean } = await response.json();
  if (!Number.isSafeInteger(index.expires) || index.expires <= Date.now() / 1000) return null;
  return {
    expires: index.expires,
    video: index.video === true,
    browse: config.browse,
    photos: config.browse ? photoLinks(index.ids, config, memberId) : [],
  };
}

export function albumError(error: string, status: number) {
  return Response.json({ error }, { status, headers: PRIVATE });
}

export async function streamAlbumFile(response: Response, contentType: string, filename?: string) {
  if (response.status === 404) return albumError("not_found", 404);
  if (!response.ok || !response.body || response.headers.get("content-type") !== contentType) {
    await response.body?.cancel();
    return albumError("unavailable", 503);
  }
  const headers = new Headers({ ...PRIVATE, "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
  const size = response.headers.get("content-length");
  if (size) headers.set("Content-Length", size);
  if (filename) headers.set("Content-Disposition", `attachment; filename="${filename}"`);
  return new Response(response.body, { headers });
}
