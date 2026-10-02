import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOpportunity } from "@/lib/db/read-models";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getPublicOpportunity(id);
  if (!item) notFound();
  const verified = new Intl.DateTimeFormat("pt-BR").format(new Date(item.last_checked_at));
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm font-semibold text-blue-700">← Voltar</Link>
      <p className="mt-10 text-sm font-medium text-slate-500">{item.institution}</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">{item.title}</h1>
      <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">Fonte oficial</span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">Revisado pela equipe</span>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Atualizado em {verified}</span>
        {item.has_retification ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Possui retificação</span> : null}
      </div>
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-7">
        <h2 className="text-2xl font-bold text-slate-950">Fonte e verificação</h2>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="text-sm text-slate-500">Instituição responsável</dt><dd className="mt-1 font-semibold">{item.institution}</dd></div>
          <div><dt className="text-sm text-slate-500">Última verificação</dt><dd className="mt-1 font-semibold">{verified}</dd></div>
        </dl>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href={item.official_document_url ?? item.source_page_url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white">Abrir edital oficial</a>
          {item.application_url ? <a href={item.application_url} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 px-4 py-3 font-semibold">Acessar inscrição oficial</a> : null}
        </div>
      </section>
      <p className="mt-8 rounded-xl bg-amber-50 p-5 text-sm leading-6 text-amber-950">
        Confirme prazos, requisitos e eventuais retificações diretamente no edital. Em caso de divergência, prevalece a fonte oficial.
      </p>
    </main>
  );
}