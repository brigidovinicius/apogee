"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { writeToolboxCategory, writeToolboxTool, ToolboxConflictError } from "@/lib/toolbox/store";
import { ToolboxInputError } from "@/lib/toolbox/validation";

export type ToolboxFormState = { error: string };
function failure(error: unknown, category: boolean): ToolboxFormState {
  if (error instanceof ToolboxInputError || error instanceof ToolboxConflictError) return { error: error.message };
  if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
    return { error: category ? "Já existe uma categoria com esse nome de referência. Edite a categoria existente ou escolha outro nome." : "Esse link já está no catálogo. Edite a ficha existente, inclusive se estiver arquivada." };
  }
  return { error: "Não foi possível salvar agora. Seus campos foram mantidos; tente novamente." };
}
function refresh() {
  for (const path of ["/admin/ferramentas", "/membros/ferramentas", "/membros"]) revalidatePath(path);
}
export async function saveToolboxCategory(_state: ToolboxFormState, form: FormData): Promise<ToolboxFormState> {
  const admin = await requireAdmin("/admin/ferramentas");
  let id: string;
  try { id = await writeToolboxCategory(admin.id, form); }
  catch (error) { return failure(error, true); }
  refresh();
  redirect(`/admin/ferramentas?categoria=${id}&salvo=categoria#editor-categoria`);
}
export async function saveToolboxTool(_state: ToolboxFormState, form: FormData): Promise<ToolboxFormState> {
  const admin = await requireAdmin("/admin/ferramentas");
  let id: string;
  try { id = await writeToolboxTool(admin.id, form); }
  catch (error) { return failure(error, false); }
  refresh();
  redirect(`/admin/ferramentas?ferramenta=${id}&salvo=ferramenta#editor-ferramenta`);
}
