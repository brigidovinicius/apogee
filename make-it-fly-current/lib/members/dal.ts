import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type CurrentMember = {
  id: string;
  name: string;
  username: string;
  role: "member" | "admin";
};

export async function getMemberFromHeaders(requestHeaders: Headers): Promise<CurrentMember | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? "",
    role: user.role === "admin" ? "admin" : "member",
  };
}

// Verificação real da sessão (o proxy.ts faz só a checagem otimista do cookie).
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  // headers() primeiro: torna a rota dinâmica antes de tocar no banco/segredo.
  return getMemberFromHeaders(await headers());
});

export async function requireMember(next?: string): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) {
    redirect(next ? `/membros/entrar?next=${encodeURIComponent(next)}` : "/membros/entrar");
  }
  return member;
}

export async function requireAdmin(next?: string): Promise<CurrentMember> {
  const member = await requireMember(next);
  if (member.role !== "admin") notFound();
  return member;
}

export async function clientIp(): Promise<string> {
  const list = await headers();
  const provider = process.env.APPLICATION_HOSTING_PROVIDER || (process.env.VERCEL === "1" ? "vercel" : "unknown");
  const header = provider === "vercel" ? "x-vercel-forwarded-for" : provider === "caddy" ? "x-forwarded-for" : null;
  if (header) return list.get(header)?.split(",")[0]?.trim() || "unknown";
  return "local";
}
