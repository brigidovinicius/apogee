"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/access";
import { surveyDefinition } from "@/lib/surveys/contract";
import { deleteExpiredSurveyResponses, saveSurvey } from "@/lib/surveys/store";

export type SurveyActionResult = { id: string; revision: number } | { error: string };
const editVersion = z.strictObject({ id: z.uuid(), revision: z.number().int().positive() });

export async function saveSurveyAction(data: unknown, version?: unknown): Promise<SurveyActionResult> {
  await requireAdmin("/admin/pesquisas");
  const parsed = surveyDefinition.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue.path[0] === "retentionDays") return { error: "Informe o prazo de retenção em dias. Para abrir, o prazo precisa ser entre 1 e 730 dias." };
    if (issue.path[0] === "slug") return { error: "Use entre 3 e 80 caracteres no endereço, com letras minúsculas, números e hífens." };
    if (issue.path[0] === "questions") return { error: "Revise as perguntas e inclua ao menos duas opções diferentes nas perguntas de escolha." };
    return { error: "Confira o título, a apresentação e a finalidade da pesquisa." };
  }
  const previous = version === undefined ? undefined : editVersion.safeParse(version);
  if (previous && !previous.success) return { error: "Recarregue a edição antes de salvar." };
  try {
    const result = await saveSurvey(parsed.data, previous?.data);
    if ("id" in result && result.id) revalidatePath("/admin/pesquisas");
    return result;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { error: "Já existe uma pesquisa com esse endereço." };
    }
    return { error: "Não foi possível salvar a pesquisa. Tente de novo." };
  }
}

export async function purgeSurveyAction(data: FormData) {
  await requireAdmin("/admin/pesquisas");
  const id = z.uuid().parse(data.get("id"));
  await deleteExpiredSurveyResponses(id);
  revalidatePath(`/admin/pesquisas/${id}/respostas`);
}
