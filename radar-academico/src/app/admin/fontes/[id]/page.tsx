import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "../../_components/nav";
import { updateSourceSettings, verifySource } from "../actions";
import { adminRows } from "@/lib/db/read-models";

export const dynamic = "force-dynamic";

type SourceDetail = {
  id: string; name: string; institution_name: string; institution_acronym: string; allowed_domains: string[];
  listing_urls: string[]; extraction_mode: string; categories: string[]; state_code: string | null; city_name: string | null;
  audit_evidence_url: string | null; verification_status: "pending" | "verified" | "rejected"; audited_at: string | null; active: boolean;
};

export default async function SourceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = (await params).id;
  const [source] = await adminRows<SourceDetail>(
    "select id,name,institution_name,institution_acronym,allowed_domains,listing_urls,extraction_mode,categories,state_code,city_name,audit_evidence_url,verification_status,audited_at,active from official_sources where id=$1",
    [id],
  );
  if (!source) notFound();
  const canAudit = source.verification_status === "pending" && !source.active;
  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />
      <section className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">{source.institution_acronym}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{source.name}</h1>
        <p className="mt-2 text-slate-600">{source.institution_name} · {source.state_code ?? "UF não informada"}{source.city_name ? ` · ${source.city_name}` : ""}</p>
        <div className="mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-white p-7 md:grid-cols-2">
          <div><h2 className="font-semibold">Domínios autorizados</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{source.allowed_domains.map((domain) => <li key={domain}>{domain}</li>)}</ul></div>
          <div><h2 className="font-semibold">URLs de listagem</h2><ul className="mt-3 space-y-2 text-sm">{source.listing_urls.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">{url}</a></li>)}</ul></div>
          <div><h2 className="font-semibold">Extração</h2><p className="mt-2 text-sm text-slate-600">{source.extraction_mode}</p></div>
          <div><h2 className="font-semibold">Auditoria</h2><p className="mt-2 text-sm text-slate-600">{source.verification_status === "verified" ? `Verificada${source.audited_at ? ` em ${new Date(source.audited_at).toLocaleDateString("pt-BR")}` : ""}` : "Pendente"}</p>{source.audit_evidence_url ? <a href={source.audit_evidence_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-blue-700 hover:underline">Abrir evidência oficial</a> : null}</div>
        </div>
        {canAudit ? <form action={verifySource} className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-7"><input type="hidden" name="id" value={source.id} /><h2 className="text-lg font-bold text-amber-950">Confirmar auditoria humana</h2><p className="mt-2 text-sm text-amber-900">A ativação continua manual e a coleta começa com os limites escolhidos na lista de fontes.</p><div className="mt-5 grid gap-3 text-sm text-amber-950"><label className="flex gap-2"><input name="official_source" type="checkbox" value="confirmed" required /> O domínio e a página de evidência pertencem à instituição pública indicada.</label><label className="flex gap-2"><input name="location_confirmed" type="checkbox" value="confirmed" required /> A UF e a cidade, quando preenchida, foram confirmadas sem inferência por texto livre.</label><label className="flex gap-2"><input name="collection_allowed" type="checkbox" value="confirmed" required /> Robots e condições de consulta foram verificados para a coleta controlada.</label></div><button className="mt-6 rounded-lg bg-amber-800 px-4 py-3 font-semibold text-white">Marcar fonte como verificada</button></form> : null}
        <form action={updateSourceSettings} className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-7 md:grid-cols-2">
          <input type="hidden" name="id" value={source.id} />
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Domínios autorizados<textarea name="domains" defaultValue={source.allowed_domains.join("\n")} className="min-h-24 rounded-lg border border-slate-300 px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium md:col-span-2">Evidência oficial para nova auditoria<input name="audit_evidence_url" type="url" required defaultValue={source.audit_evidence_url ?? source.listing_urls[0]} className="rounded-lg border border-slate-300 px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Intervalo em horas<input name="interval" type="number" min="2" defaultValue="24" className="rounded-lg border border-slate-300 px-4 py-3" /></label>
          <label className="grid gap-2 text-sm font-medium">Modo<select name="mode" defaultValue={source.extraction_mode} className="rounded-lg border border-slate-300 px-4 py-3"><option>rss</option><option>html</option><option>pdf</option><option>api</option><option>sitemap</option><option>manual_assisted</option><option>reference_only</option><option>disabled</option></select></label>
          <button className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white md:col-span-2">Salvar configurações</button>
        </form>
      </section>
    </main>
  );
}
