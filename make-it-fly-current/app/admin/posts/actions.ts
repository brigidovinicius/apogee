"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/access";
import { getAdminPost, savePost } from "@/lib/blog/data";
import { BLOG_CATEGORIES, blogSlug, parseBrasiliaTime } from "@/lib/blog/shared";
import { parseVideoUrl } from "@/lib/blog/video";

export type EditorState = { message?: string; errors?: Record<string, string>; values?: Record<string, string> };

const categoryValues = BLOG_CATEGORIES.map((category) => category.value);
const postSchema = z.object({
  title: z.string().trim().min(5, "Escreva um título com ao menos 5 caracteres.").max(140),
  excerpt: z.string().trim().min(20, "Escreva um resumo com ao menos 20 caracteres.").max(400),
  body: z.string().trim().min(50, "Escreva o artigo com ao menos 50 caracteres.").max(60_000),
  category: z.string().refine((value) => categoryValues.includes(value as typeof categoryValues[number]), "Selecione um tema válido."),
  seoTitle: z.string().trim().max(70, "O título SEO pode ter até 70 caracteres."),
  seoDescription: z.string().trim().max(160, "A descrição SEO pode ter até 160 caracteres."),
  focusKeyword: z.string().trim().max(80, "A palavra-chave foco pode ter até 80 caracteres."),
  videoUrl: z.string().trim().max(300, "O link do vídeo pode ter até 300 caracteres."),
});

function read(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) return false;
    if ("code" in current && current.code === "23505") return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function saveBlogPost(id: number | null, _state: EditorState, form: FormData): Promise<EditorState> {
  const admin = await requireAdmin(id === null ? "/admin/posts/novo" : `/admin/posts/${id}`);
  const values = Object.fromEntries(
    ["title", "slug", "excerpt", "body", "category", "seoTitle", "seoDescription", "focusKeyword", "seoNoIndex", "coverMediaId", "videoUrl", "scheduledAt", "featured"]
      .map((key) => [key, read(form, key)]),
  );
  const fail = (state: EditorState): EditorState => ({ ...state, values });
  const intent = read(form, "intent");
  if (!["save", "publish", "schedule", "unpublish", "archive"].includes(intent)) {
    return fail({ message: "Ação inválida." });
  }
  const parsed = postSchema.safeParse({
    title: read(form, "title"), excerpt: read(form, "excerpt"), body: read(form, "body"),
    category: read(form, "category"), seoTitle: read(form, "seoTitle"),
    seoDescription: read(form, "seoDescription"), focusKeyword: read(form, "focusKeyword"),
    videoUrl: read(form, "videoUrl"),
  });
  if (!parsed.success) return fail({ errors: fieldErrors(parsed.error), message: "Revise os campos indicados." });
  if (parsed.data.videoUrl && !parseVideoUrl(parsed.data.videoUrl)) {
    return fail({ errors: { videoUrl: "Use um link HTTPS válido do YouTube ou Vimeo." } });
  }

  const slug = blogSlug(read(form, "slug") || parsed.data.title);
  if (slug.length < 3) return fail({ errors: { slug: "Defina um endereço com ao menos 3 caracteres." } });

  const current = id === null ? null : await getAdminPost(id);
  if (id !== null && !current) return fail({ message: "Artigo não encontrado." });
  if (current && current.slug !== slug && (current.publishedAt || current.scheduledAt)) {
    return fail({ errors: { slug: "O endereço de um artigo já publicado ou agendado não pode ser alterado." } });
  }
  const revision = Number(read(form, "revision"));
  if (id !== null && (!Number.isInteger(revision) || revision < 1 || revision !== current?.revision)) {
    return fail({ message: "Este artigo foi alterado em outra aba. Atualize a página antes de salvar." });
  }

  const scheduledAt = intent === "schedule" ? parseBrasiliaTime(read(form, "scheduledAt")) : null;
  if (intent === "schedule" && (!scheduledAt || scheduledAt.getTime() <= Date.now() + 60_000)) {
    return fail({ errors: { scheduledAt: "Escolha uma data futura no horário de Brasília." } });
  }

  try {
    const saved = await savePost({
      id, revision: id === null ? null : revision, slug,
      title: parsed.data.title, excerpt: parsed.data.excerpt, body: parsed.data.body,
      category: parsed.data.category as (typeof BLOG_CATEGORIES)[number]["value"],
      featured: read(form, "featured") === "on",
      seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null,
      focusKeyword: parsed.data.focusKeyword || null,
      seoNoIndex: read(form, "seoNoIndex") === "on",
      coverMediaId: read(form, "coverMediaId") || null,
      videoUrl: parsed.data.videoUrl || null,
      intent: intent as "save" | "publish" | "schedule" | "unpublish" | "archive",
      scheduledAt, actorId: admin.id, actorName: admin.name,
    });
    if (saved === "conflict") return fail({ message: "Este artigo foi alterado em outra aba. Atualize a página antes de salvar." });
    revalidatePath("/blog");
    revalidatePath(`/blog/${saved.slug}`);
    if (current && current.slug !== saved.slug) revalidatePath(`/blog/${current.slug}`);
    revalidatePath("/sitemap.xml");
    revalidatePath("/admin/posts");
    redirect(`/admin/posts/${saved.id}?salvo=1`);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail({ errors: { slug: "Esse endereço já está em uso." } });
    }
    throw error;
  }
}
