"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { withAdminTransaction } from "@/lib/db/client";
import { decideOpportunity } from "@/lib/official-sources/review";

export async function reviewOpportunity(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  await decideOpportunity({ id, decision, reviewer: "radar-admin" });
  revalidatePath("/admin/revisao");
  revalidatePath("/");
}

export async function reviewRevision(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!["approve", "reject"].includes(decision)) throw new Error("Decisão inválida");
  await withAdminTransaction(async (client) => {
    const result = await client.query("select * from opportunity_revisions where id=$1 and review_status='pending_review'", [id]);
    const revision = result.rows[0];
    if (!revision) throw new Error("Retificação não encontrada");
    if (decision === "reject") {
      await client.query("update opportunity_revisions set review_status='rejected',reviewed_at=now(),reviewed_by='admin' where id=$1", [id]);
      return;
    }
    const next = revision.new_data;
    await client.query(
      `update opportunities set deadline_at=coalesce($1,deadline_at),
       deadline_precision=coalesce($2,deadline_precision),
       opportunity_status=coalesce($3,opportunity_status),has_retification=true,
       retification_summary=$4,review_status='approved',human_verified_at=now(),
       human_verified_by='admin',updated_at=now() where id=$5`,
      [next.deadlineAt ?? null, next.deadlinePrecision ?? null, next.opportunityStatus ?? null,
       revision.change_summary, revision.opportunity_id],
    );
    await client.query("update opportunity_revisions set review_status='approved',reviewed_at=now(),reviewed_by='admin' where id=$1", [id]);
  });
  revalidatePath("/admin/revisao");
  revalidatePath("/");
}
