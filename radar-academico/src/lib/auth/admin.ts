import crypto from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "radar_admin";
const SESSION_MS = 8 * 60 * 60 * 1000;
const scrypt = promisify(crypto.scrypt);
let activeHashes = 0;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  return value && value.length >= 32 ? value : null;
}

export async function verifyAdminPassword(password: string) {
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored || !password || password.length > 1024 || activeHashes >= 2) return false;
  const match = /^scrypt\$([a-fA-F0-9]{32})\$([a-fA-F0-9]{128})$/.exec(stored);
  if (!match) return false;
  activeHashes += 1;
  try {
    const actual = await scrypt(password, match[1], 64) as Buffer;
    return crypto.timingSafeEqual(actual, Buffer.from(match[2], "hex"));
  } catch {
    return false;
  } finally {
    activeHashes -= 1;
  }
}

export async function createAdminSession() {
  const key = secret();
  if (!key) return false;
  const expiresAt = Date.now() + SESSION_MS;
  const payload = `v1.${expiresAt}.${crypto.randomBytes(16).toString("hex")}`;
  const signature = crypto.createHmac("sha256", key).update(payload).digest("hex");
  const store = await cookies();
  store.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SESSION_MS / 1000,
  });
  return true;
}

export function verifyAdminToken(token: string | undefined, now = Date.now()) {
  const key = secret();
  if (!key || !token) return false;
  const match = /^(v1\.(\d{13})\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expiry = Number(match[2]);
  if (!Number.isSafeInteger(expiry) || expiry <= now || expiry > now + SESSION_MS) return false;
  const expected = crypto.createHmac("sha256", key).update(match[1]).digest();
  return crypto.timingSafeEqual(Buffer.from(match[3], "hex"), expected);
}

export async function isAdmin() {
  return verifyAdminToken((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}
