import "server-only";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { getDb } from "./db";
import { googleUsernameFromSubject } from "./google-oauth";
import * as schema from "./schema";
import { nameSchema, usernameSchema } from "./validation";

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres).");
  }

  return betterAuth({
    appName: "Apogee Membros",
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // Sem domínio próprio ainda não há envio de e-mail; verificação e reset
      // de senha entram quando o domínio for comprado (Resend).
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        // O Google informa a verificação do e-mail no ID token. Exigimos esse
        // sinal antes de criar sessão ou permitir a entrada com este provider.
        requireEmailVerification: true,
        // A tela de entrada não deve criar uma conta por acidente. A tela de
        // cadastro envia requestSignUp explicitamente.
        disableImplicitSignUp: true,
        mapProfileToUser: (profile) => ({ username: googleUsernameFromSubject(profile.sub) }),
      },
    },
    user: {
      additionalFields: {
        bio: { type: "string", required: false, input: false },
        role: { type: "string", required: false, defaultValue: "member", input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/username": { window: 60, max: 5 },
        "/sign-up/email": { window: 3600, max: 5 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-forwarded-for"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    databaseHooks: {
      user: {
        create: {
          // Vale também para chamadas diretas a /api/auth/sign-up/email.
          before: async (user) => {
            const name = nameSchema.safeParse(user.name);
            const handle = usernameSchema.safeParse((user as { username?: unknown }).username);
            if (!name.success || !handle.success) {
              throw new APIError("BAD_REQUEST", { message: "Nome ou usuário inválido." });
            }
            return { data: { ...user, name: name.data, username: handle.data, role: "member" } };
          },
        },
      },
    },
    plugins: [
      username({
        displayUsername: false,
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => usernameSchema.safeParse(value).success,
      }),
      nextCookies(), // precisa ser o último plugin
    ],
  });
}

export type MembersAuth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as typeof globalThis & { __apogeeMembersAuth?: MembersAuth };

export function getAuth(): MembersAuth {
  globalForAuth.__apogeeMembersAuth ??= createAuth();
  return globalForAuth.__apogeeMembersAuth;
}
