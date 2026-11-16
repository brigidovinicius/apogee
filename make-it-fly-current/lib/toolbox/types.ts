export type ToolboxStatus = "draft" | "published" | "archived";
export const TOOLBOX_STATUS_LABELS: Record<ToolboxStatus, string> = {
  draft: "Rascunho", published: "Publicado", archived: "Arquivado",
};
export type ToolboxCategory = {
  id: string; slug: string; name: string; description: string | null;
  status: ToolboxStatus; order: number; version: number;
};
export type ManagedTool = {
  id: string; categoryId: string; name: string; description: string; url: string;
  conditions: string | null; status: ToolboxStatus; order: number; version: number;
  reviewedAt: string | null; reviewedByName: string | null;
};
export type MemberToolCategory = Pick<ToolboxCategory, "slug" | "name" | "description"> & { count: number };
export type MemberTool = Pick<ManagedTool, "id" | "name" | "description" | "url" | "conditions"> & {
  categorySlug: string; categoryName: string;
};
