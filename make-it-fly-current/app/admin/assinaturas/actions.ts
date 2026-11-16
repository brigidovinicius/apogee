"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/members/dal";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { reconcileAnnualMembership } from "@/lib/billing/community-operations";
export type ReconcileState = { message?: string; ok?: boolean };
export async function reconcileMembership(_: ReconcileState, form: FormData): Promise<ReconcileState> {
  const actor = await requireAdmin("/admin/assinaturas");
  if (!await consumeRateLimit(`annual-reconcile:${actor.id}`, 6, 3600)) return { message: "Aguarde antes de conciliar novamente." };
  try {
    const count = await reconcileAnnualMembership(String(form.get("id") ?? ""));
    revalidatePath("/admin/assinaturas"); revalidatePath("/membros", "layout");
    return { ok: true, message: `Conciliação concluída: ${count} faturas consultadas. Os direitos refletem os pagamentos e períodos confirmados.` };
  } catch { return { message: "Conciliação não concluída. Confira configuração, vínculo e entregas do webhook antes de tentar novamente. Nenhum pagamento foi criado." }; }
}
