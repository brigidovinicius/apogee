"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/members/dal";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { setLearningProgress } from "@/lib/deliverables/store";

export type ProgressState = { message?: string; ok?: boolean };
export async function updateProgress(_: ProgressState, form: FormData): Promise<ProgressState> {
  const member = await requireMember("/membros/trilha");
  if (!await consumeRateLimit(`learning-progress:${member.id}`, 60, 60)) return { message: "Aguarde um pouco antes de tentar novamente." };
  try {
    await setLearningProgress({ activityId: form.get("activityId"), completed: form.get("completed") === "true" });
  } catch { return { message: "Não foi possível salvar. Confira seu acesso e tente novamente." }; }
  revalidatePath("/membros/trilha");
  return { ok: true, message: "Progresso salvo na sua conta." };
}
