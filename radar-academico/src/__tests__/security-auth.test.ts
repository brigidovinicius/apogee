import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(path); }) }));
import { cookies, headers } from "next/headers";
import { createAdminSession, verifyAdminPassword, verifyAdminToken } from "@/lib/auth/admin";
import * as adminAuth from "@/lib/auth/admin";
import { secretMatches, trustedClientIp, WindowLimiter, readLimitedBody } from "@/lib/security";
const key = "test-only-session-key-".repeat(3);
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("admin fail closed", () => {
  it("rejects malformed, expired, future, tampered and legacy tokens without throwing", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", key);
    for (const token of [undefined, "", "NaN.ab", "9999999999999." + "ff".repeat(32), "v1.9999999999999." + "a".repeat(32) + "." + "b".repeat(64)]) expect(verifyAdminToken(token)).toBe(false);
  });
  it("creates a nonce-bound signed session and rejects secret rotation", async () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", key);
    const set = vi.fn();
    vi.mocked(cookies).mockResolvedValue({ set } as never);
    expect(await createAdminSession()).toBe(true);
    const token = set.mock.calls[0][1] as string;
    expect(verifyAdminToken(token)).toBe(true);
    expect(verifyAdminToken(token + ".extra")).toBe(false);
    expect(verifyAdminToken(token, Date.now() + 9 * 3600_000)).toBe(false);
    vi.stubEnv("ADMIN_SESSION_SECRET", "rotated-key-".repeat(4));
    expect(verifyAdminToken(token)).toBe(false);
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    expect(verifyAdminToken(token)).toBe(false);
    expect(await createAdminSession()).toBe(false);
  });
  it("uses async scrypt, validates stored format, caps password and concurrent work", async () => {
    const salt = "ab".repeat(16);
    const hash = crypto.scryptSync("correct", salt, 64).toString("hex");
    vi.stubEnv("ADMIN_PASSWORD_HASH", `scrypt$${salt}$${hash}`);
    const syncSpy = vi.spyOn(crypto, "scryptSync");
    expect(await verifyAdminPassword("correct")).toBe(true);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(await Promise.all([
      verifyAdminPassword("correct"), verifyAdminPassword("correct"), verifyAdminPassword("correct"),
    ])).toEqual([true, true, false]);
    expect(await verifyAdminPassword("wrong")).toBe(false);
    expect(await verifyAdminPassword("a".repeat(1025))).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD_HASH", "scrypt$salt$zz");
    expect(await verifyAdminPassword("correct")).toBe(false);
  });
  it("login limits attempts before hashing, including spoofed forwarded IPs", async () => {
    const verify = vi.spyOn(adminAuth, "verifyAdminPassword").mockResolvedValue(false);
    vi.stubEnv("TRUST_PROXY_CLIENT_IP", "false");
    vi.mocked(headers).mockResolvedValue(new Headers({ "x-forwarded-for": "8.8.8.8" }) as never);
    const { login } = await import("@/app/admin/login/actions");
    const form = new FormData(); form.set("password", "wrong");
    for (let i = 0; i < 6; i++) await expect(login(form)).rejects.toThrow("/admin/login?erro=1");
    expect(verify).toHaveBeenCalledTimes(5);
  });
});

it("constant-time secret check handles mismatched lengths and absent config", () => {
  expect(secretMatches("yes", "yes")).toBe(true);
  expect(secretMatches("a", "longer")).toBe(false);
  expect(secretMatches("a", undefined)).toBe(false);
  expect(secretMatches("", "")).toBe(false);
});
it("bounded limiter fails closed at capacity and expires buckets", () => {
  const limiter = new WindowLimiter(2, 100, 1);
  expect(limiter.take("a", 0)).toBe(true);
  expect(limiter.take("b", 1)).toBe(false);
  expect(limiter.take("a", 2)).toBe(true);
  expect(limiter.take("a", 3)).toBe(false);
  expect(limiter.take("b", 101)).toBe(true);
  vi.stubEnv("TRUST_PROXY_CLIENT_IP", "false");
  expect(trustedClientIp(new Headers({ "x-real-ip": "8.8.8.8" }))).toBeNull();
});
it("caps streamed bodies without Content-Length and cancels overflows/timeouts", async () => {
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } });
  await expect(readLimitedBody(new Response(stream), 5)).rejects.toThrow("Limite");
  expect(cancelled).toBe(true);
  await expect(readLimitedBody(new Response(new ReadableStream({})), 5, 10)).rejects.toThrow("Tempo");
});
