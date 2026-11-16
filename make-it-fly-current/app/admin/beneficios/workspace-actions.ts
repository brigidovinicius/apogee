"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/members/dal";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { BenefitActionError, saveBenefitCategory, reviewBenefitRedemption } from "@/lib/benefits/store";
export type BenefitManagementState = { ok?: boolean; message?: string };
function failure(error: unknown): BenefitManagementState { return { message: error instanceof BenefitActionError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message : "Não foi possível salvar. Confira os campos e nomes já utilizados." }; }
function invalidate() { revalidatePath("/admin/beneficios"); revalidatePath("/membros/beneficios", "layout"); }
export async function saveCategoryAction(_: BenefitManagementState, form: FormData): Promise<BenefitManagementState> {
  const actor = await requireAdmin("/admin/beneficios");
  if (!await consumeRateLimit(`benefit-admin:${actor.id}`, 60, 60)) return { message: "Aguarde antes de tentar novamente." };
  try { await saveBenefitCategory({ ...(form.get("id") ? { id: form.get("id"), version: form.get("version") } : {}), name: form.get("name"), description: form.get("description"), status: form.get("status"), sortOrder: form.get("sortOrder") }); }
  catch (error) { return failure(error); }
  invalidate(); return { ok: true, message: "Categoria salva. Apenas categorias publicadas com ofertas vigentes aparecem no catálogo." };
}
export async function reviewRedemptionAction(_: BenefitManagementState, form: FormData): Promise<BenefitManagementState> {
  const actor = await requireAdmin("/admin/beneficios");
  if (!await consumeRateLimit(`benefit-admin:${actor.id}`, 60, 60)) return { message: "Aguarde antes de tentar novamente." };
  try { await reviewBenefitRedemption({ id: form.get("id"), revision: form.get("revision"), status: form.get("status"), evidenceReference: form.get("evidenceReference") }); }
  catch (error) { return failure(error); }
  invalidate(); return { ok: true, message: "Conferência registrada. A referência permanece privada na administração." };
}
