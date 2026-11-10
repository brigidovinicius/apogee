import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { approvedEvidence, assessDossier, dossierHash, referenceCatalog, referenceUrl, taxonomy, validateDossier, type Dossier, type Claim, type Document, type Assessment } from "./corroboration.mjs";

export type DossierVersion = { revision: number; document: Dossier; document_hash: string; assessment: Assessment; reviewed_by: string | null; source_hash: string; actor_id: string; created_at: Date; change_reason: string };
export async function getDossierView(id: string) {
  const sql = getSql();
  const [{ ready }] = await sql<{ ready: boolean }[]>`select to_regclass('blog_worker.dossier_version') is not null as ready`;
  if (!ready) return null;
  const [candidate] = await sql<{ id: string; title: string; editoria: string; status: string; reason: string | null; post_id: number | null; evidence_hash: string }[]>`select id,title,editoria,status,reason,post_id,evidence_hash from blog_worker.candidate where id=${id}`;
  if (!candidate) return null;
  const versions = await sql<DossierVersion[]>`select revision,document,document_hash,assessment,reviewed_by,source_hash,actor_id,created_at,change_reason from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 20`;
  const [post] = candidate.post_id ? await sql<{ id: number; title: string; body: string; revision: number; status: string }[]>`select id,title,body,revision,status from public.blog_post where id=${candidate.post_id}` : [];
  const [{ busy }] = await sql<{ busy: boolean }[]>`select exists(select 1 from blog_worker.command where state in ('queued','running')) as busy`;
  const captured = await sql<{ id: string; document: { title: string; url: string; text: string } }[]>`select id,document from blog_worker.captured_document where candidate_id=${id} order by captured_at desc limit 20`;
  const [control] = await sql<{ available: boolean }[]>`select coalesce(not paused and (snapshot->>'generation_enabled')::boolean and snapshot->>'provider'='google_subscription' and heartbeat_at between now()-interval '4 minutes' and now(),false) as available from blog_worker.control where singleton=true`;
  return { candidate, latest: versions[0] ?? null, versions, post: post ?? null, busy, captured, available: control?.available ?? false };
}

async function changeDossier(actor: string, id: string, expected: number, reason: string, mutate: (d: Dossier) => Dossier, review = false) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const [candidate] = await tx`select * from blog_worker.candidate where id=${id} for update`;
    if (!candidate) return false;
    const [previous] = await tx<DossierVersion[]>`select * from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    if ((previous?.revision ?? 0) !== expected) return false;
    const category = candidate.editoria === "startups" ? "negocios" : candidate.editoria === "ciencia-espaco" ? "ciencia" : "tecnologia";
    const base: Dossier = previous?.document ?? { schema_version: 1, event_key: candidate.url, category, subcategory: candidate.editoria === "ia" ? "ia" : null, documents: [], claims: [] };
    const document = validateDossier(mutate(structuredClone(base)));
    if (candidate.first_attempt_day && (document.category !== base.category || document.subcategory !== base.subcategory)) throw Object.assign(new Error("topic_locked_after_start"), { code: "topic_locked_after_start" });
    const assessment = assessDossier(document, { comparisonVerified: document.claims.length > 0 });
    if (review && (!assessment.eligible || previous?.source_hash !== candidate.evidence_hash)) return false;
    const revision = expected + 1;
    await tx`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,reviewed_by,reviewed_at,source_hash,change_reason)
      values(${id},${revision},${JSON.stringify(document)}::jsonb,${dossierHash(document)},${JSON.stringify(assessment)}::jsonb,${actor},${review ? actor : null},${review ? new Date().toISOString() : null},${candidate.evidence_hash},${reason})`;
    await tx`update blog_worker.candidate set status=${candidate.post_id ? "draft" : assessment.eligible ? "ready" : "held"},reason=${assessment.eligible ? null : assessment.blockers[0]} where id=${id}`;
    await tx`insert into blog_worker.operator_event(actor_id,action,target,detail) values(${actor},${review ? "dossier_reviewed" : "dossier_changed"},${id},${JSON.stringify({ revision, previous_hash: previous?.document_hash ?? null, hash: assessment.hash, reason })}::jsonb)`;
    return true;
  });
}
export async function initializeDossier(actor: string, id: string) {
  return changeDossier(actor, id, 0, "Início da pesquisa multifonte", d => d);
}
export async function saveDossierDocument(actor: string, id: string, revision: number, document: Omit<Document, "content_hash">, reason: string) {
  return changeDossier(actor, id, revision, reason, d => {
    const index = d.documents.findIndex(v => v.id === document.id);
    const next = { ...document, content_hash: dossierHash(document.text) };
    if (index < 0) d.documents.push(next); else d.documents[index] = next;
    d.claims = []; // Evidence changes require a new comparison; immutable history is retained.
    return d;
  });
}
export async function importCapturedDocument(actor: string, id: string, revision: number, capturedId: string) {
  const [row] = await getSql()<{ document: Omit<Document, "kind" | "origin_url" | "same_event" | "independence_note" | "reference_id"> }[]>`select document from blog_worker.captured_document where id=${capturedId} and candidate_id=${id}`;
  if (!row) return false;
  const ref = referenceCatalog.find(r => new URL(r.url).hostname.replace(/^www\./, "") === new URL(row.document.url).hostname.replace(/^www\./, ""));
  if (!ref) return false;
  return changeDossier(actor, id, revision, "Evidência captada adicionada para conferir acontecimento e origem", d => {
    d.documents.push({ ...row.document, id: "E" + (Math.max(0, ...d.documents.map(v => Number(v.id.slice(1)))) + 1), reference_id: ref.id,
      kind: "context", origin_url: row.document.url, same_event: false, independence_note: "" });
    d.claims = []; return d;
  });
}
export async function saveDossierScope(actor: string, id: string, revision: number, scope: Pick<Dossier, "event_key" | "category" | "subcategory">, reason: string) {
  return changeDossier(actor, id, revision, reason, d => ({ ...d, ...scope, claims: [] }));
}
export async function saveDossierClaim(actor: string, id: string, revision: number, claim: Claim, reason: string) {
  return changeDossier(actor, id, revision, reason, d => {
    const index = d.claims.findIndex(v => v.id === claim.id);
    if (index < 0) d.claims.push(claim); else d.claims[index] = claim;
    return d;
  });
}
export async function reviewDossier(actor: string, id: string, revision: number) {
  return changeDossier(actor, id, revision, "Editor conferiu matriz, fontes, independência e fatos críticos", d => d, true);
}
export async function requestDossierComparison(actor: string, id: string, revision: number) {
  const sql = getSql();
  return sql.begin(async tx => {
    const [control] = await tx`select * from blog_worker.control where singleton=true for update`;
    const [v] = await tx<DossierVersion[]>`select * from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    const [c] = await tx`select post_id from blog_worker.candidate where id=${id}`;
    if (c?.post_id || !v || v.revision !== revision || control.paused || control.snapshot?.provider !== "google_subscription" || control.snapshot?.generation_enabled !== true || v.document.documents.length < 2 || v.document.documents.some(d => !d.same_event)) return false;
    if ((await tx`select id from blog_worker.command where state in ('queued','running')`).length) return false;
    await tx`insert into blog_worker.command(id,kind,candidate_id,actor_id) values(${randomUUID()},'compare',${id},${actor})`;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},'comparison_requested',${id})`;
    return true;
  });
}
export async function reviewFinalArticle(actor: string, id: string, revision: number) {
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const [c] = await tx`select * from blog_worker.candidate where id=${id} for update`;
    const [v] = await tx<DossierVersion[]>`select * from blog_worker.dossier_version where candidate_id=${id} order by revision desc limit 1`;
    if (!c?.post_id || !v?.assessment.comparison_verified || v.source_hash !== c.evidence_hash || !assessDossier(v.document, { comparisonVerified: true }).eligible || c.reason === "source_changed_after_reservation") return false;
    approvedEvidence(v.document, { hash: v.document_hash, actor_id: v.actor_id });
    const [p] = await tx`select p.*,blog_worker.post_content_hash(p) as content_hash from public.blog_post p where id=${c.post_id} for update`;
    if (!p || p.revision !== revision || p.status !== "draft") return false;
    await tx`insert into blog_worker.post_review(candidate_id,post_id,dossier_revision,content_hash,actor_id) values(${id},${p.id},${v.revision},${p.content_hash},${actor})`;
    await tx`insert into blog_worker.operator_event(actor_id,action,target,detail) values(${actor},'article_factual_reviewed',${id},${JSON.stringify({ post_revision: revision, dossier_revision: v.revision })}::jsonb)`;
    return true;
  });
}
export async function createResearchCandidate(actor: string, input: { reference_id: string; url: string; title: string; published_at: string; category: string; subcategory: string | null }) {
  const reference = referenceCatalog.find(r => r.id === input.reference_id);
  if (!reference || !Object.hasOwn(taxonomy,input.category)) return null;
  const url = referenceUrl(input.url, reference), id = dossierHash(url);
  const editoria = input.category === "ciencia" ? "ciencia-espaco" : input.category === "negocios" ? "startups" : input.subcategory === "ia" ? "ia" : "tecnologia";
  const document = validateDossier({ schema_version: 1, event_key: url, category: input.category, subcategory: input.subcategory, documents: [], claims: [] });
  const sql = getSql();
  return sql.begin(async tx => {
    await tx`select singleton from blog_worker.control where singleton=true for update`;
    const inserted = await tx`insert into blog_worker.candidate(id,source_id,guid,url,event_key,title,editoria,score,published_at,evidence,evidence_hash,status,reason)
      values(${id},'EDITORIAL',${id},${url},${dossierHash(url)},${input.title},${editoria},50,${input.published_at},'[]'::jsonb,${dossierHash([])},'held','comparison_incomplete') on conflict do nothing returning id`;
    if (!inserted.length) return null;
    await tx`insert into blog_worker.dossier_version(candidate_id,revision,document,document_hash,assessment,actor_id,source_hash,change_reason) values(${id},1,${JSON.stringify(document)}::jsonb,${dossierHash(document)},${JSON.stringify(assessDossier(document))}::jsonb,${actor},${dossierHash([])},'Pesquisa iniciada pelo editor')`;
    await tx`insert into blog_worker.operator_event(actor_id,action,target) values(${actor},'research_created',${id})`;
    return id;
  });
}
