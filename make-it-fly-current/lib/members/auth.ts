import "server-only";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { applicationOrigin, sendMemberMail } from "./mail";
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
    logger: { log: () => { console.error("[membros] ocorrência do provedor de autenticação"); } },
    onAPIError: { onError: (error) => {
      if (error instanceof APIError && error.status !== "INTERNAL_SERVER_ERROR") throw error;
      throw new APIError("INTERNAL_SERVER_ERROR", { message: "Não foi possível concluir a autenticação." });
    } },
    secret,
    baseURL: applicationOrigin(),
    trustedOrigins: [applicationOrigin()],
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      // O acesso público existente é preservado. Convites exigem verificação no servidor.
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: false,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => {
        const target = new URL(url);
        if (target.origin !== applicationOrigin()) throw new Error("Origem inválida.");
        await sendMemberMail({ to: user.email, subject: "Confirme seu e-mail na Apogee",
          text: `Confirme o controle do seu e-mail: ${target.href}\n\nDepois, volte à Apogee para continuar. A verificação não concede papel administrativo.` });
      },
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
        mapProfileToUser: (profile) => ({
          username: googleUsernameFromSubject(profile.sub),
          // Nunca persiste nome inválido do provedor; confirmação é obrigatória.
          name: nameSchema.safeParse(profile.name).success ? nameSchema.parse(profile.name) : "Membro",
          nameNeedsConfirmation: true,
        }),
      },
    },
    account: {
      accountLinking: {
        // Impede vincular uma credencial social a um cadastro local cujo e-mail
        // ainda não foi confirmado. A confirmação agora está disponível no convite.
        requireLocalEmailVerified: true,
        // O vínculo automático continua limitado ao e-mail idêntico e não
        // altera nenhum dado da conta local já existente.
        allowDifferentEmails: false,
        updateUserInfoOnLink: false,
      },
    },
    user: {
      additionalFields: {
        canManageAdmins: { type: "boolean", required: false, defaultValue: false, input: false },
        blocked: { type: "boolean", required: false, defaultValue: false, input: false },
        nameNeedsConfirmation: { type: "boolean", required: false, defaultValue: false, input: false },
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
        "/send-verification-email": { window: 3600, max: 5 },
        "/verify-email": { window: 60, max: 10 },
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
            return { data: { ...user, name: name.data, username: handle.data, role: "member", canManageAdmins: false, blocked: false } };
          },
        },
        update: {
          before: async (data) => {
            if (data.name === undefined) return;
            const parsed = nameSchema.safeParse(data.name);
            if (!parsed.success) throw new APIError("BAD_REQUEST", { message: "Informe seu nome, sem links ou e-mails." });
            return { data: { ...data, name: parsed.data } };
          },
        },
      },
      session: {
        create: {
          before: async (data) => {
            const [account] = await getDb().select({ blocked: schema.user.blocked }).from(schema.user).where(eq(schema.user.id, data.userId));
            if (!account || account.blocked) throw new APIError("FORBIDDEN", { message: "Conta indisponível." });
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
