import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { user as users } from "./schema";
import { nameSchema } from "./validation";
import { getAuth } from "./auth";
import { isGeneratedGoogleUsername } from "./validation";

export type CurrentMember = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  role: "member" | "admin";
  nameNeedsConfirmation: boolean;
};

export async function getMemberFromHeaders(requestHeaders: Headers): Promise<CurrentMember | null> {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  // Papel/bloqueio vêm da linha atual, nunca de cookie cacheado ou metadados.
  const [user] = await getDb().select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user || user.blocked) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? "",
    image: user.image ?? null,
    nameNeedsConfirmation: user.nameNeedsConfirmation || !nameSchema.safeParse(user.name).success,
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
  if (isGeneratedGoogleUsername(member.username) || member.nameNeedsConfirmation) {
    const destination = next ?? "/membros";
    redirect(`/membros/perfil/configurar?next=${encodeURIComponent(destination)}`);
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
