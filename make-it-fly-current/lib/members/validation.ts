import { z } from "zod";

// Regras compartilhadas entre formulários, server actions e testes.
// Sem "server-only" de propósito: é puro e testável.

export const USERNAME_PATTERN = /^[a-z0-9_.]+$/;
const RESERVED_USERNAMES = new Set(["admin", "apogee", "membros", "moderador", "suporte", "editar", "root"]);

// Contas criadas com Google recebem este identificador provisório até a
// pessoa escolher um nome público na etapa final do cadastro.
export function isGeneratedGoogleUsername(value: string): boolean {
  return /^google_[a-f0-9]{20}$/.test(value);
}

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O usuário precisa de pelo menos 3 caracteres.")
  .max(30, "O usuário pode ter no máximo 30 caracteres.")
  .regex(USERNAME_PATTERN, "Use só letras minúsculas, números, ponto e sublinhado.")
  .refine((value) => !RESERVED_USERNAMES.has(value), "Esse nome de usuário é reservado.");

export const publicUsernameSchema = usernameSchema.refine(
  (value) => !isGeneratedGoogleUsername(value),
  "Escolha outro nome de usuário.",
);

export const NAME_ERROR = "Informe seu nome, sem links ou e-mails.";

// Política de aceitação: não decodifica URL/HTML nem faz consultas de rede.
// O limite bruto vem antes de normalização/regex; controles nunca viram espaços.
export const nameSchema = z.string({ error: NAME_ERROR })
  .max(400, NAME_ERROR)
  .pipe(z.string()
  .refine((value) => !/[\p{C}\p{Zl}\p{Zp}]/u.test(value), NAME_ERROR)
  .transform((value) => value.normalize("NFC").replace(/\p{Zs}+/gu, " ").trim())
  .refine((value) => [...value].length >= 1 && [...value].length <= 100, NAME_ERROR)
  .refine((value) => /\p{L}/u.test(value) && /^[\p{L}\p{M} '\u2019\u02bc.\-]+$/u.test(value), NAME_ERROR)
  // Pontos só encerram iniciais isoladas: Ana M. e A. M.; example.com não passa.
  .refine((value) => value.split(" ").every((part) => !part.includes(".") || /^\p{L}\p{M}*\.$/u.test(part)), NAME_ERROR));

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido."));

export const passwordSchema = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.");

export const signUpSchema = z.object({
  name: nameSchema,
  username: publicUsernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.").max(128),
});

export const postBodySchema = z
  .string()
  .trim()
  .min(2, "Escreva uma mensagem.")
  .max(10_000, "A mensagem pode ter no máximo 10.000 caracteres.");

export const topicSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "O título precisa de pelo menos 5 caracteres.")
    .max(120, "O título pode ter no máximo 120 caracteres."),
  body: postBodySchema,
});

export const replySchema = z.object({ body: postBodySchema });

export const profileSchema = z.object({
  name: nameSchema,
  bio: z.string().trim().max(500, "A bio pode ter no máximo 500 caracteres."),
});

export const POSTS_PER_MINUTE = 5;
export const TOPICS_PAGE_SIZE = 20;
export const POSTS_PAGE_SIZE = 20;

export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "topico";
}

export function topicParam(id: number, slug: string): string {
  return `${id}-${slug}`;
}

/** "42-como-voar" → 42. Retorna null para qualquer coisa que não comece com um id positivo. */
export function parseTopicParam(param: string): number | null {
  const match = /^(\d{1,9})(?:-|$)/.exec(param);
  if (!match) return null;
  const id = Number(match[1]);
  return id > 0 ? id : null;
}

export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

const INTERNAL_ORIGIN = "https://apogee.invalid";

/** Aceita só destinos internos protegidos. Cada rota mantém sua autorização no servidor. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.includes("\\")) return "/membros";

  try {
    const next = new URL(value, INTERNAL_ORIGIN);
    if (next.origin !== INTERNAL_ORIGIN) return "/membros";
    const protectedPath = next.pathname === "/membros" || next.pathname.startsWith("/membros/") ||
      next.pathname === "/admin" || next.pathname.startsWith("/admin/") ||
      next.pathname === "/gerenciar-galeria";
    if (!protectedPath) return "/membros";
    return `${next.pathname}${next.search}${next.hash}`;
  } catch {
    return "/membros";
  }
}

export type FieldErrors = Partial<Record<string, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
