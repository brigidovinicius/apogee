"use server";

import { createAdminSession, verifyAdminPassword } from "@/lib/auth/admin";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!(await verifyAdminPassword(password))) redirect("/admin/login?erro=1");
  await createAdminSession();
  redirect("/admin/fontes");
}