"use server";

import { createAdminSession, verifyAdminPassword } from "@/lib/auth/admin";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { trustedClientIp, WindowLimiter } from "@/lib/security";

const perClient = new WindowLimiter(5, 15 * 60_000);
const globalLimit = new WindowLimiter(30, 15 * 60_000, 1);

export async function login(formData: FormData) {
  const ip = trustedClientIp(await headers()) ?? "unknown";
  if (!perClient.take(ip) || !globalLimit.take("admin")) redirect("/admin/login?erro=1");
  const password = String(formData.get("password") ?? "");
  if (!(await verifyAdminPassword(password))) redirect("/admin/login?erro=1");
  if (!(await createAdminSession())) redirect("/admin/login?erro=1");
  redirect("/admin/fontes");
}
