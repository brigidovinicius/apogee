"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { candidateKey, coverSchema, sourceSchema } from "@/lib/blog/pipeline-validation";
import { applyReviewedCover, editPipelineCover, enqueuePipeline, holdPipelineCandidate, savePipelineSource, setPipelinePaused } from "@/lib/blog/pipeline";

const read = (form: FormData, key: string) => typeof form.get(key) === "string" ? String(form.get(key)) : "";
const split = (value: string) => value.split(",").map(x => x.trim()).filter(Boolean);
export async function managePipeline(form: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/posts/pipeline");
  const intent = read(form, "intent");
  let message = "invalid";
  try {
    if (intent === "source") {
      const parsed = sourceSchema.safeParse({
        id: read(form, "id"), name: read(form, "name"), editoria: read(form, "editoria"), url: read(form, "url"),
        article_hosts: split(read(form, "article_hosts")), keywords: split(read(form, "keywords")), interval_minutes: Number(read(form, "interval_minutes")),
        enabled: read(form, "enabled") === "on", feed_content_approved: read(form, "feed_content_approved") === "on",
        collection_approval_reference: read(form, "collection_approval_reference"), rights_reference: read(form, "rights_reference"),
      });
      const revision = Number(read(form, "revision"));
      if (parsed.success && Number.isSafeInteger(revision) && revision >= 0) message = await savePipelineSource(admin.id, { ...parsed.data, type: "rss" }, revision) ? "saved" : "conflict";
    } else if (intent === "collect" || intent === "generate") {
      const id = candidateKey.safeParse(read(form, "candidate_id"));
      if (intent === "collect" || id.success) message = await enqueuePipeline(admin.id, intent, intent === "generate" && id.success ? id.data : null) ? "queued" : "conflict";
    } else if (intent === "pause" || intent === "resume") {
      message = await setPipelinePaused(admin.id, intent === "pause") ? (intent === "pause" ? "paused" : "resumed") : "unresolved";
    } else if (intent === "hold" || intent === "release") {
      const id = candidateKey.safeParse(read(form, "candidate_id"));
      if (id.success) message = await holdPipelineCandidate(admin.id, id.data, intent === "hold") ? "saved" : "conflict";
    } else if (intent === "cover") {
      const cover = coverSchema.safeParse({ candidate_id: read(form, "candidate_id"), prompt: read(form, "prompt"), alt: read(form, "alt"), caption: read(form, "caption") });
      if (cover.success) message = await editPipelineCover(admin.id, cover.data) ? "saved" : "conflict";
    } else if (intent === "apply_cover") {
      const id = candidateKey.safeParse(read(form, "candidate_id")), revision = Number(read(form, "revision"));
      if (id.success && Number.isSafeInteger(revision) && revision > 0) message = await applyReviewedCover(admin.id, id.data, revision) ? "cover_applied" : "conflict";
    }
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
    message = code === "42P01" || code === "3F000" ? "unavailable" : code === "23505" ? "conflict" : "failed";
  }
  revalidatePath("/admin/posts/pipeline");
  revalidatePath("/admin/posts");
  if (message === "cover_applied") revalidatePath("/admin/posts/[id]", "page");
  redirect(`/admin/posts/pipeline?message=${message}`);
}
