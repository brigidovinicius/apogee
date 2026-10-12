export const BLOG_CATEGORIES = [
  { value: "estudos", label: "Estudos" },
  { value: "empreendedorismo", label: "Empreendedorismo" },
  { value: "tecnologia", label: "Tecnologia" },
  { value: "ciencias", label: "Ciências" },
  { value: "geral", label: "Assuntos gerais" },
  { value: "atualidades", label: "Atualidades" },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["value"];
export type BlogStatus = "draft" | "scheduled" | "published" | "archived";

export function categoryLabel(value: string): string {
  return BLOG_CATEGORIES.find((item) => item.value === value)?.label ?? "Assuntos gerais";
}

export function blogSlug(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90).replace(/-+$/g, "");
}

export function isPublicPost(post: { status: BlogStatus; publishedAt: Date | null; scheduledAt: Date | null }, now = new Date()): boolean {
  return (post.status === "published" && !!post.publishedAt && post.publishedAt <= now)
    || (post.status === "scheduled" && !!post.scheduledAt && post.scheduledAt <= now);
}

export function postDate(post: { status: BlogStatus; publishedAt: Date | null; scheduledAt: Date | null }): Date | null {
  return post.status === "scheduled" ? post.scheduledAt : post.publishedAt;
}

export function statusLabel(post: { status: BlogStatus; publishedAt: Date | null; scheduledAt: Date | null }, now = new Date()): string {
  if (isPublicPost(post, now)) return "Publicado";
  return { draft: "Rascunho", scheduled: "Agendado", published: "Publicado", archived: "Arquivado" }[post.status];
}

export function parseBrasiliaTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(" ", "T");
  return parts === value ? date : null;
}
