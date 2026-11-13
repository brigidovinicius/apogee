"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { candidateKey } from "@/lib/blog/pipeline-validation";
import { getDossierView, initializeDossier, importCapturedDocument, saveDossierDocument, saveDossierClaim, saveDossierScope, reviewDossier, requestDossierComparison, reviewFinalArticle, createResearchCandidate } from "@/lib/blog/dossier";
import { isExplainer, type Cell } from "@/lib/blog/corroboration.mjs";
import { parseBrasiliaTime } from "@/lib/blog/shared";

const read = (f: FormData, k: string) => typeof f.get(k) === "string" ? String(f.get(k)).trim() : "";
const date = (s: string) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""; const parsed = new Date(s + "T12:00:00Z"); return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === s ? parsed.toISOString() : ""; };
export async function manageDossier(form: FormData): Promise<void> {
  const admin = await requireAdmin("/admin/posts/pipeline");
  const intent = read(form, "intent"), revision = Number(read(form, "revision"));
  const parsed = candidateKey.safeParse(read(form, "candidate_id"));
  let id = parsed.success ? parsed.data : null, message = "invalid";
  try {
    if (intent === "new_research") {
      const title = read(form, "title"), published_at = date(read(form, "published_at")), [category, subcategory] = read(form, "topic").split(":");
      if (title.length >= 8 && title.length <= 220 && published_at && Date.parse(published_at) < Date.now() + 86400000) {
        id = await createResearchCandidate(admin.id, { title, published_at, category, subcategory: subcategory || null, reference_id: read(form, "reference_id"), url: read(form, "url") });
        message = id ? "saved" : "conflict";
      }
    } else if (id && Number.isSafeInteger(revision) && revision >= 0) {
      let saved = false;
      const reason = read(form, "reason");
      if (intent === "initialize") saved = await initializeDossier(admin.id, id);
      else if (intent === "import_captured" && candidateKey.safeParse(read(form, "captured_id")).success) saved = await importCapturedDocument(admin.id, id, revision, read(form, "captured_id"));
      else if (intent === "compare") { saved = await requestDossierComparison(admin.id, id, revision); if (saved) message = "queued"; }
      else if (intent === "review" && read(form, "confirmed") === "on") saved = await reviewDossier(admin.id, id, revision);
      else if (intent === "review_article" && read(form, "confirmed") === "on") saved = await reviewFinalArticle(admin.id, id, revision);
      else if (reason.length >= 8 && reason.length <= 1000) {
        if (intent === "scope") {
          const [category, subcategory] = read(form, "topic").split(":");
          saved = await saveDossierScope(admin.id, id, revision, { event_key: read(form, "event_key"), category, subcategory: subcategory || null }, reason);
        } else if (intent === "document") {
          const view = await getDossierView(id), explainer = isExplainer(view?.latest?.document);
          const consulted = explainer ? parseBrasiliaTime(read(form, "consulted_at")) : null;
          const published_at = date(read(form, "published_at"));
          if ((!explainer || consulted && +consulted <= Date.now()) && (!read(form, "published_at") || published_at) && (!published_at || Date.parse(published_at) < Date.now() + 86400000)) saved = await saveDossierDocument(admin.id, id, revision, {
            id: read(form, "document_id"), reference_id: read(form, "reference_id"), title: read(form, "title"), url: read(form, "url"), published_at: published_at || null,
            text: read(form, "text"), rights_reference: read(form, "rights_reference"), kind: read(form, "kind") as "primary",
            origin_url: read(form, "origin_url"), independence_note: read(form, "independence_note"), same_event: !explainer && read(form, "same_event") === "on",
            ...(explainer ? {same_subject:read(form, "same_subject")==="on", excerpt_offset:Number(read(form, "excerpt_offset")), consulted_at:consulted!.toISOString()} : {}),
          }, reason);
        } else if (intent === "claim") {
          const view = await getDossierView(id);
          if (view?.latest?.revision === revision) saved = await saveDossierClaim(admin.id, id, revision, {
            id: read(form, "claim_id"), text: read(form, "claim_text"), critical: read(form, "critical") === "on",
            cells: view.latest.document.documents.map(d => ({ document_id: d.id, status: read(form, "status_" + d.id) as Cell["status"], quote: read(form, "quote_" + d.id), note: read(form, "note_" + d.id) })),
          }, reason);
        }
      }
      message = saved ? message === "queued" ? message : "saved" : "conflict";
    }
  } catch (error) { message = error instanceof Error && error.message === "topic_locked_after_start" ? "topic_locked_after_start" : "invalid"; }
  revalidatePath("/admin/posts/pipeline");
  if (id) revalidatePath(`/admin/posts/pipeline/dossie/${id}`);
  redirect(id ? `/admin/posts/pipeline/dossie/${id}?message=${message}` : `/admin/posts/pipeline?message=${message}`);
}
