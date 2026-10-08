import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentMember } from "@/lib/members/dal";

export const metadata: Metadata = {
  title: { default: "Administração | Apogee", template: "%s | Admin Apogee" },
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Esta leitura controla somente a shell. Cada página/DAL continua fazendo a
  // própria autorização, pois layouts não são uma fronteira de segurança.
  const member = await getCurrentMember();
  return <AdminShell showModeSwitcher={member?.role === "admin"}>{children}</AdminShell>;
}
