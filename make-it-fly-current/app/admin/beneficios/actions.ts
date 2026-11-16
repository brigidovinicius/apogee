"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/members/dal";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { DeliverableConflictError, saveDeliverable } from "@/lib/deliverables/store";
import type { DeliverableKind } from "@/lib/deliverables/validation";
import { z } from "zod";
export type EditorialState = { message?: string; ok?: boolean; revision?: string };
const fields = {
  benefit: ["partner", "description", "evidenceUrl", "eligibility", "availability", "startsAt", "endsAt", "redemption", "redemptionUrl", "categoryId", "providerLabel", "providerAccess", "sourceUrl"],
  track: ["description"], module: ["trackId", "description", "deliverable"], activity: ["moduleId", "instructions", "resourceUrl"],
};
export async function saveEditorial(_: EditorialState, form: FormData): Promise<EditorialState> {
  const actor = await requireAdmin("/admin/beneficios");
  if (!await consumeRateLimit(`member-editorial:${actor.id}`, 60, 60)) return { message: "Aguarde um pouco antes de tentar novamente." };
  const kind = form.get("kind");
  if (typeof kind !== "string" || !Object.hasOwn(fields, kind)) return { message: "Tipo de conteúdo inválido." };
  const text = (key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
  const input: Record<string, string> = { name: text("name"), status: text("status"), sortOrder: text("sortOrder") };
  if (text("id")) { input.id = text("id"); input.revision = text("revision"); }
  for (const key of fields[kind as DeliverableKind]) input[key] = text(key);
  let saved;
  try { saved = await saveDeliverable(kind as DeliverableKind, input); }
  catch (error) { return { message: error instanceof DeliverableConflictError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message : "Não foi possível salvar. Confira os vínculos e tente novamente." }; }
  for (const path of ["/admin/beneficios", "/admin/trilha", "/membros/beneficios", "/membros/trilha"]) revalidatePath(path, "layout");
  return { ok: true, revision: saved.revision, message: "Conteúdo salvo. Confira o estado editorial antes de anunciar disponibilidade." };
}
