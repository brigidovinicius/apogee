import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { getOfficialSource } from "@/lib/official-sources/registry";
import { AdminNav } from "../../_components/nav";
import { updateSourceSettings } from "../actions";

export const dynamic = "force-dynamic";

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const source = getOfficialSource((await params).id);
  if (!source) notFound();
  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">{source.institutionAcronym}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{source.name}</h1>
        <div className="mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-white p-7 md:grid-cols-2">
          <div><h2 className="font-semibold">Domínios autorizados</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{source.allowedDomains.map((domain) => <li key={domain}>{domain}</li>)}</ul></div>
          <div><h2 className="font-semibold">URLs de listagem</h2><ul className="mt-3 space-y-2 text-sm">{source.listingUrls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{url}</a></li>)}</ul></div>
          <div><h2 className="font-semibold">Extração</h2><p className="mt-2 text-sm text-slate-600">{source.extractionMode}</p></div>
          <div><h2 className="font-semibold">Categorias</h2><p className="mt-2 text-sm text-slate-600">{source.categories.join(", ")}</p></div>
        </div>
        {source.notes ? <p className="mt-6 rounded-xl bg-amber-50 p-5 text-sm text-amber-950">{source.notes}</p> : null}
        <form action={updateSourceSettings} className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-7 md:grid-cols-2">
          <input type="hidden" name="id" value={source.id} />
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Domínios autorizados<textarea name="domains" defaultValue={source.allowedDomains.join("\n")} className="min-h-24 rounded-lg border border-slate-300 px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Intervalo em horas<input name="interval" type="number" min="2" defaultValue="24" className="rounded-lg border border-slate-300 px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Modo<select name="mode" defaultValue={source.extractionMode} className="rounded-lg border border-slate-300 px-4 py-3"><option>rss</option><option>html</option><option>pdf</option><option>api</option><option>sitemap</option><option>manual_assisted</option><option>reference_only</option><option>disabled</option></select></label>
          <button className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white md:col-span-2">Salvar configurações</button>
        </form>
      </section>
    </main>
  );
}