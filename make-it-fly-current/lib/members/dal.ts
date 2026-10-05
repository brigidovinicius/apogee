import "server-only";
import { eq } from "drizzle-orm";
import { connection } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { hexclaveServerApp } from "@/lib/hexclave/server";
import { getDb } from "./db";
import { stableMemberUsername } from "./google-oauth";
import { hexclaveIdentity, user } from "./schema";

export type CurrentMember = {
  id: string;
  name: string;
  username: string;
  role: "member" | "admin";
};

type MemberRow = CurrentMember;

async function findMemberForHexclaveUser(hexclaveUserId: string): Promise<MemberRow | null> {
  const [member] = await getDb()
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    })
    .from(hexclaveIdentity)
    .innerJoin(user, eq(user.id, hexclaveIdentity.memberId))
    .where(eq(hexclaveIdentity.hexclaveUserId, hexclaveUserId))
    .limit(1);
  return member ? { ...member, username: member.username ?? "", role: member.role === "admin" ? "admin" : "member" } : null;
}

function nameForLegacyMember(displayName: string | null): string {
  const normalized = displayName?.trim().slice(0, 60) ?? "";
  return normalized.length >= 2 ? normalized : "Membro Apogee";
}

/**
 * Preserva a autoria já existente: no primeiro acesso, associamos a conta
 * Hexclave ao usuário com o mesmo e-mail. Para novos membros, criamos apenas
 * a linha legada necessária às chaves estrangeiras do fórum.
 */
async function provisionLegacyMember(input: {
  hexclaveUserId: string;
  primaryEmail: string | null;
  primaryEmailVerified: boolean;
  displayName: string | null;
}): Promise<MemberRow> {
  const linked = await findMemberForHexclaveUser(input.hexclaveUserId);
  if (linked) return linked;

  if (!input.primaryEmail) {
    throw new Error("A conta Stack Auth precisa ter um e-mail principal para acessar o fórum.");
  }

  const db = getDb();
  let [legacy] = await db
    .select({ id: user.id, name: user.name, username: user.username, role: user.role })
    .from(user)
    .where(eq(user.email, input.primaryEmail.toLowerCase()))
    .limit(1);

  if (!legacy) {
    await db
      .insert(user)
      .values({
        id: input.hexclaveUserId,
        name: nameForLegacyMember(input.displayName),
        email: input.primaryEmail.toLowerCase(),
        emailVerified: input.primaryEmailVerified,
        username: stableMemberUsername(input.hexclaveUserId),
        role: "member",
      })
      .onConflictDoNothing();

    [legacy] = await db
      .select({ id: user.id, name: user.name, username: user.username, role: user.role })
      .from(user)
      .where(eq(user.email, input.primaryEmail.toLowerCase()))
      .limit(1);
  }

  if (!legacy) throw new Error("Não foi possível vincular a conta Stack Auth ao membro do fórum.");

  await db
    .insert(hexclaveIdentity)
    .values({ hexclaveUserId: input.hexclaveUserId, memberId: legacy.id })
    .onConflictDoNothing();

  const member = await findMemberForHexclaveUser(input.hexclaveUserId);
  if (!member) {
    throw new Error("Essa conta Stack Auth já está vinculada a outro membro do fórum.");
  }
  return member;
}

// Verificação real da sessão; o proxy só antecipa o redirecionamento.
export const getCurrentMember = cache(async (): Promise<CurrentMember | null> => {
  // A sessão deve ser lida por requisição. Isso também impede que o Next tente
  // pré-renderizar páginas autenticadas durante o build da imagem Docker.
  await connection();
  const hexclaveUser = await hexclaveServerApp.getUser();
  if (!hexclaveUser) return null;
  return provisionLegacyMember({
    hexclaveUserId: hexclaveUser.id,
    primaryEmail: hexclaveUser.primaryEmail,
    primaryEmailVerified: hexclaveUser.primaryEmailVerified,
    displayName: hexclaveUser.displayName,
  });
});

export async function requireMember(next?: string): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }
  return member;
}

export async function clientIp(): Promise<string> {
  const list = await headers();
  const provider = process.env.APPLICATION_HOSTING_PROVIDER || (process.env.VERCEL === "1" ? "vercel" : "unknown");
  const header = provider === "vercel" ? "x-vercel-forwarded-for" : provider === "caddy" ? "x-forwarded-for" : null;
  if (header) return list.get(header)?.split(",")[0]?.trim() || "unknown";
  return "local";
}
