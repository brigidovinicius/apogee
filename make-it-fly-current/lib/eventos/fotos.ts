import "server-only";
import { createHmac } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { getMemberFromHeaders } from "@/lib/members/dal";
import { adultAccess } from "@/lib/members/protection";
import { PHOTO_API, WORKSHOP, type AlbumPhoto } from "./catalogo";

export const PRIVATE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
export const PHOTO_ID = /^[a-f0-9]{32}$/;

export function albumConfig() {
  if (process.env.APOGEE_WORKSHOP_MEDIA_ENABLED !== "true") return null;
  const base = process.env.APOGEE_WORKSHOP_MEDIA_URL ?? "";
  const secret = process.env.ALBUM_SECRET ?? "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost|photos):8786$/.test(base) ||
      !/^[a-zA-Z0-9_-]{32,128}$/.test(secret)) return null;
  const allowed = new Set((process.env.APOGEE_WORKSHOP_MEDIA_MEMBER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean));
  const members = process.env.APOGEE_WORKSHOP_MEDIA_AUDIENCE === "members";
  if (!members && !allowed.size) return null;
  return {
    base: `${base}/${WORKSHOP.slug}`, secret, allowed, members,
    browse: process.env.APOGEE_WORKSHOP_MEDIA_BROWSE === "true",
    selfie: process.env.APOGEE_WORKSHOP_SELFIE_ENABLED === "true",
  };
}

type AlbumConfig = NonNullable<ReturnType<typeof albumConfig>>;

export function canAccessAlbum(memberId: string, config: AlbumConfig) {
  return config.members || config.allowed.has(memberId);
}

export async function albumMember(headers: Headers, config: AlbumConfig, forSelfie = false) {
  if (!getSessionCookie(headers)) return null;
  const member = await getMemberFromHeaders(headers);
  if (!member || !canAccessAlbum(member.id, config) || (forSelfie && !await adultAccess(member.id))) return null;
  return member;
}

export function albumWorker(config: AlbumConfig, path: string, init?: RequestInit, timeout = 25_000) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${config.secret}`);
  return fetch(`${config.base}${path}`, {
    ...init, headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeout),
  });
}

function actorKey(config: AlbumConfig, id: string) {
  return createHmac("sha256", config.secret).update(JSON.stringify(["actor", WORKSHOP.slug, id])).digest("hex");
}

export function albumIdentity(config: AlbumConfig, memberId: string) {
  return { "X-Album-Member": memberId, "X-Album-Actor": actorKey(config, memberId) };
}

export function photoLinks(ids: unknown): AlbumPhoto[] {
  if (!Array.isArray(ids) || ids.length > 400 || !ids.every(id => typeof id === "string" && PHOTO_ID.test(id))) {
    throw new Error("Lista de fotos inválida.");
  }
  return [...new Set<string>(ids)].map(id => ({
    id, thumbnail: `${PHOTO_API}/${id}/thumb`, download: `${PHOTO_API}/${id}/download`,
  }));
}

export async function readAlbum(config: AlbumConfig, includePhotos = config.browse) {
  const response = await albumWorker(config, "/photos");
  if (!response.ok) return null;
  const index: { ids: unknown; expires: number | null; video: boolean } = await response.json();
  if (index.expires !== null && (!Number.isSafeInteger(index.expires) || index.expires <= Date.now() / 1000)) return null;
  return {
    expires: index.expires,
    video: index.video === true,
    browse: config.browse,
    photos: includePhotos ? photoLinks(index.ids) : [],
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
