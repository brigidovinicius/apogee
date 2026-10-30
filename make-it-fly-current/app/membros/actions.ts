"use server";

import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/members/auth";
import { clientIp, getCurrentMember, requireMember } from "@/lib/members/dal";
import * as forum from "@/lib/members/forum";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { billingConfig, RADAR_ACCESS_PATH, radarBillingEnabled } from "@/lib/billing/config";
import { radarPurchaseNeedsVerification } from "@/lib/billing/store";
import { supervisedRegistrationEnabled } from "@/lib/members/protection";
import {
  POSTS_PER_MINUTE,
  type FieldErrors,
  fieldErrors,
  parseTopicParam,
  profileSchema,
  nameSchema,
  publicUsernameSchema,
  replySchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
  isGeneratedGoogleUsername,
  topicParam,
  topicSchema,
} from "@/lib/members/validation";

export type FormState = {
  errors?: FieldErrors;
  message?: string;
  values?: Record<string, string>;
  ok?: boolean;
};

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

const TOO_MANY = "Muitas tentativas. Aguarde um pouco e tente de novo.";

// Checagem estrutural: o APIError lançado pelo Better Auth pode vir de outra
// cópia da classe (better-call), então instanceof não é confiável.
function isApiError(error: unknown): error is { status?: string; body?: { code?: string } } {
  return typeof error === "object" && error !== null && "body" in error && "status" in error;
}

function authErrorMessage(error: unknown, fallback: string): string {
  if (isApiError(error)) {
    const code = String(error.body?.code ?? "");
    if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      return "Já existe uma conta com esse e-mail.";
    }
    if (code === "USERNAME_IS_ALREADY_TAKEN") return "Esse nome de usuário já está em uso.";
    if (code === "INVALID_EMAIL_OR_PASSWORD") return "E-mail ou senha incorretos.";
    if (error.status === "TOO_MANY_REQUESTS") return TOO_MANY;
  }
  console.error("[membros] erro de autenticação");
  return fallback;
}

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  const values = { name: text(form, "name"), username: text(form, "username"), email: text(form, "email") };
  const parsed = signUpSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if(supervisedRegistrationEnabled() && text(form,"adultDeclared")!=="on")return {message:"A conta deve pertencer a um adulto. O responsável poderá vincular menores após a verificação.",values};

  if (!(await consumeRateLimit(`signup:${await clientIp()}`, 5, 3600))) return { message: TOO_MANY, values };

  let needsVerification = false;
  try {
    const result = await getAuth().api.signUpEmail({ body: {...parsed.data,adultDeclared:supervisedRegistrationEnabled()}, headers: await headers() });
    // Mostra a orientação também a quem iniciou o cadastro sem um next do Radar.
    try {
      needsVerification = radarBillingEnabled() && await radarPurchaseNeedsVerification(result.user.id, billingConfig().livemode);
    } catch { /* A conta foi criada; a página do Radar permite verificar/reenviar. */ }
  } catch (error) {
    return { message: authErrorMessage(error, "Não foi possível criar sua conta agora."), values };
  }
  redirect(needsVerification ? RADAR_ACCESS_PATH : safeNextPath(text(form, "next")));
}

export async function completeUsername(_: FormState, form: FormData): Promise<FormState> {
  const member = await getCurrentMember();
  if (!member) redirect("/membros/entrar");
  const next = safeNextPath(text(form, "next"));
  if (!isGeneratedGoogleUsername(member.username) && !member.nameNeedsConfirmation) redirect(next);

  const values = { username: text(form, "username"), name: text(form, "name") };
  const name = nameSchema.safeParse(values.name);
  if (!name.success) return { errors: { name: "Informe seu nome, sem links ou e-mails." }, values };
  const parsed = publicUsernameSchema.safeParse(values.username);
  if (!parsed.success) return { errors: { username: parsed.error.issues[0]?.message ?? "Escolha um nome de usuário válido." }, values };

  try {
    const updated = await forum.completeGoogleUsername(member.id, member.username, parsed.data, name.data);
    if (!updated) return { message: "Seu cadastro já foi concluído. Entre novamente para continuar.", values };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return { errors: { username: "Esse nome de usuário já está em uso." }, values };
    }
    console.error("[membros] erro ao concluir nome de usuário", error);
    return { message: "Não foi possível salvar o nome de usuário agora.", values };
  }

  revalidatePath("/membros", "layout");
  redirect(next);
}

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ ...values, password: text(form, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const ip = await clientIp();
  // A cota por conta é aplicada no hook do auth, também nos endpoints diretos.
  const allowed = await consumeRateLimit(`signin-ip:${ip}`, 20, 600);
  if (!allowed) return { message: TOO_MANY, values };

  try {
    await getAuth().api.signInEmail({ body: parsed.data, headers: await headers() });
  } catch (error) {
    return { message: authErrorMessage(error, "Não foi possível entrar agora."), values };
  }
  // O login substitui sua entrada no histórico: Voltar retorna à página
  // de origem, sem revisitar o login e redirecionar para esta sessão de novo.
  redirect(safeNextPath(text(form, "next")), RedirectType.replace);
}

export async function signOut(): Promise<void> {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/membros/entrar");
}

async function postingAllowed(userId: string) {
  return consumeRateLimit(`post:${userId}`, POSTS_PER_MINUTE, 60);
}

export async function createTopic(_: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const values = { title: text(form, "title"), body: text(form, "body") };
  const parsed = topicSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const category = await forum.getCategory(text(form, "category"));
  if (!category) return { message: "Categoria não encontrada.", values };
  if (!(await postingAllowed(member.id))) return { message: TOO_MANY, values };

  const topic = await forum.createTopic({ authorId: member.id, categoryId: category.id, ...parsed.data });
  revalidatePath("/membros", "layout");
  redirect(`/membros/forum/${category.slug}/${topicParam(topic.id, topic.slug)}`);
}

export async function createReply(_: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const values = { body: text(form, "body") };
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const topicId = parseTopicParam(text(form, "topic"));
  const topic = topicId ? await forum.getTopic(topicId) : null;
  if (!topic) return { message: "Tópico não encontrado.", values };
  if (!(await postingAllowed(member.id))) return { message: TOO_MANY, values };

  await forum.createReply({ authorId: member.id, topicId: topic.id, body: parsed.data.body });
  const path = `/membros/forum/${topic.categorySlug}/${topicParam(topic.id, topic.slug)}`;
  revalidatePath("/membros", "layout");
  // Vai para a última página, onde a resposta nova aparece.
  const { pages } = await forum.listPosts(topic.id, 1);
  redirect(pages > 1 ? `${path}?pagina=${pages}#fim` : `${path}#fim`);
}

export async function editPost(_: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const values = { body: text(form, "body") };
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const postId = Number(text(form, "post"));
  if (!Number.isInteger(postId) || postId <= 0) return { message: "Mensagem inválida.", values };

  const updated = await forum.editOwnPost({ authorId: member.id, postId, body: parsed.data.body });
  if (!updated) return { message: "Você só pode editar suas próprias mensagens.", values };
  revalidatePath("/membros", "layout");
  return { ok: true };
}

export async function deletePost(_: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const postId = Number(text(form, "post"));
  if (!Number.isInteger(postId) || postId <= 0) return { message: "Mensagem inválida." };

  const result = await forum.deleteOwnPost({ authorId: member.id, postId });
  if (result.status === "not-found") return { message: "Você só pode apagar suas próprias mensagens." };
  if (result.status === "has-replies") {
    return { message: "O tópico já tem respostas; edite a mensagem em vez de apagá-la." };
  }
  revalidatePath("/membros", "layout");
  if (result.topicDeleted) redirect(`/membros/forum/${safeCategory(text(form, "category"))}`);
  return { ok: true };
}

function safeCategory(slug: string) {
  return /^[a-z0-9-]{1,80}$/.test(slug) ? slug : "";
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const member = await requireMember();
  const values = { name: text(form, "name"), bio: text(form, "bio") };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  await forum.updateProfile({ userId: member.id, ...parsed.data });
  revalidatePath("/membros", "layout");
  redirect(`/membros/perfil/${member.username}`);
}
