import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type CurrentMember = {
  id: string;
  name: string;
  username: string;
  role: "member" | "admin";
};

// Verificação real da sessão (o proxy.ts faz só a checagem otimista do cookie).
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  // headers() primeiro: torna a rota dinâmica antes de tocar no banco/segredo.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { user } = session;
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? "",
    role: user.role === "admin" ? "admin" : "member",
  };
});

export async function requireMember(next?: string): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) {
    redirect(next ? `/membros/entrar?next=${encodeURIComponent(next)}` : "/membros/entrar");
  }
  return member;
}

export async function clientIp(): Promise<string> {
  const list = await headers();
  if (process.env.VERCEL === "1") {
    return list.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
  return "local";
}
