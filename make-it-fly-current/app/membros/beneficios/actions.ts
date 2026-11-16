"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMember } from "@/lib/members/dal";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { BenefitActionError, setSavedBenefit, startBenefitRedemption } from "@/lib/benefits/store";
export type BenefitActionState = { ok?: boolean; message?: string; saved?: boolean; destination?: string; redemptionStatus?: "started" | "confirmed" | "rejected" };
function invalidate() {
  for (const path of ["/membros/beneficios", "/membros/beneficios/salvos", "/membros/beneficios/resgates", "/admin/beneficios"]) revalidatePath(path);
}
function failure(error: unknown): BenefitActionState { return { message: error instanceof BenefitActionError ? error.message : error instanceof z.ZodError ? "Confira a oferta e tente novamente." : "Não foi possível concluir. Tente novamente em instantes." }; }
export async function saveBenefitAction(_: BenefitActionState, form: FormData): Promise<BenefitActionState> {
  const member = await requireMember("/membros/beneficios");
  if (!await consumeRateLimit(`benefit-save:${member.id}`, 60, 60)) return { message: "Aguarde um pouco antes de tentar novamente." };
  let result;
  try { result = await setSavedBenefit({ benefitId: form.get("benefitId"), saved: form.get("saved") === "true" }); }
  catch (error) { return failure(error); }
  invalidate();
  return { ok: true, saved: result.saved, message: result.saved ? "Oferta salva." : "Oferta removida dos salvos." };
}
export async function startBenefitAction(_: BenefitActionState, form: FormData): Promise<BenefitActionState> {
  const member = await requireMember("/membros/beneficios");
  if (!await consumeRateLimit(`benefit-start:${member.id}`, 20, 60)) return { message: "Aguarde um pouco antes de tentar novamente." };
  let result;
  try { result = await startBenefitRedemption({ benefitId: form.get("benefitId") }); }
  catch (error) { return failure(error); }
  invalidate();
  const message = result.status === "confirmed" ? "Este resgate já foi confirmado. Reabrir as instruções não cria outro pedido." : result.status === "rejected" ? "Este resgate consta como não aprovado. Reabrir as instruções não altera o resultado." : "Resgate iniciado. Siga as instruções abaixo. O benefício ainda depende da validação do parceiro.";
  return { ok: true, destination: result.destination, redemptionStatus: result.status, message };
}
