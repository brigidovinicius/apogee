import { requireAdmin } from "@/lib/auth/admin";
import { adminRows } from "@/lib/db/read-models";
import { AdminNav } from "../_components/nav";
import { reviewOpportunity, reviewRevision } from "./actions";

export const dynamic = "force-dynamic";

interface ReviewItem { id: string; title: string; institution: string; applicant_type: string; application_route: string; deadline_at: string | null; deadline_precision: string; evidence_json: Record<string, { source_url: string; excerpt: string; page?: number }>; source_page_url: string; official_document_url: string | null }
interface RevisionItem { id: string; opportunity_id: string; source_url: string; change_summary: string; previous_data: Record<string, unknown>; new_data: Record<string, unknown> }

export default async function ReviewPage() {
  await requireAdmin();
  const items = await adminRows<ReviewItem>(
    `select o.id,o.title,o.institution,o.applicant_type,o.application_route,o.deadline_at,o.deadline_precision,o.evidence_json,
      os.source_page_url,os.official_document_url from opportunities o
      join lateral (select * from opportunity_sources where opportunity_id=o.id order by is_primary desc limit 1) os on true
      where o.review_status in ('pending_review','needs_information') order by o.created_at`,
  );
  const revisions = await adminRows<RevisionItem>("select * from opportunity_revisions where review_status='pending_review' order by created_at");
  return (
    <main className="min-h-screen bg-slate-50"><AdminNav /><section className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Controle editorial</p><h1 className="mt-2 text-3xl font-bold">Fila de revisão humana</h1>
      <p className="mt-3 text-slate-600">Nenhum item é publicado por esta fila sem ação explícita do administrador.</p>
      {revisions.length ? <section className="mt-8"><h2 className="text-xl font-bold">Retificações pendentes</h2><div className="mt-4 space-y-4">{revisions.map((revision) => <article key={revision.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><a href={revision.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700">Abrir retificação oficial</a><p className="mt-3 text-sm text-amber-950">{revision.change_summary}</p><pre className="mt-4 overflow-auto rounded-lg bg-white p-4 text-xs">{JSON.stringify(revision.new_data, null, 2)}</pre><form action={reviewRevision} className="mt-4 flex gap-3"><input type="hidden" name="id" value={revision.id} /><button name="decision" value="approve" className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white">Aplicar retificação</button><button name="decision" value="reject" className="rounded-lg border border-red-200 bg-white px-4 py-2 font-semibold text-red-700">Rejeitar</button></form></article>)}</div></section> : null}
      <div className="mt-8 space-y-6">{items.map((item) => (
        <article key={item.id} className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-2">
          <div className="border-b border-slate-200 bg-slate-50 p-6 lg:border-b-0 lg:border-r"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fonte e evidências</p>
            <a href={item.official_document_url ?? item.source_page_url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all font-semibold text-blue-700 hover:underline">Abrir fonte oficial</a>
            <div className="mt-5 space-y-4">{Object.entries(item.evidence_json ?? {}).map(([field, evidence]) => <div key={field}><p className="text-xs font-semibold text-slate-500">{field}{evidence.page ? ` · página ${evidence.page}` : ""}</p><p className="mt-1 text-sm leading-6 text-slate-700">{evidence.excerpt}</p></div>)}</div>
          </div>
          <div className="p-6"><p className="text-sm text-slate-500">{item.institution}</p><h2 className="mt-2 text-xl font-bold">{item.title}</h2>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Público</dt><dd className="mt-1 font-semibold">{item.applicant_type}</dd></div><div><dt className="text-slate-500">Candidatura</dt><dd className="mt-1 font-semibold">{item.application_route}</dd></div><div><dt className="text-slate-500">Prazo</dt><dd className="mt-1 font-semibold">{item.deadline_at ?? item.deadline_precision}</dd></div></dl>
            <form action={reviewOpportunity} className="mt-8 flex gap-3"><input type="hidden" name="id" value={item.id} /><button name="decision" value="approve" className="rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white">Aprovar e publicar</button><button name="decision" value="reject" className="rounded-lg border border-red-200 px-4 py-3 font-semibold text-red-700">Rejeitar</button></form>
          </div>
        </article>
      ))}{!items.length ? <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">A fila está vazia.</p> : null}</div>
    </section></main>
  );
}