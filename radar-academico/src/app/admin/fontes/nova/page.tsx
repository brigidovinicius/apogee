import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "../../_components/nav";
import { createSource } from "../actions";
import { BRAZILIAN_STATE_CODES } from "@/lib/location";

export const dynamic = "force-dynamic";

export default async function NewSourcePage() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-slate-50"><AdminNav /><section className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Cadastro controlado</p>
      <h1 className="mt-2 text-3xl font-bold">Nova fonte oficial</h1>
      <p className="mt-3 text-slate-600">A fonte será criada inativa e pendente de validação administrativa.</p>
      <form action={createSource} className="mt-8 grid gap-5 rounded-2xl border border-slate-200 bg-white p-7">
        <label className="grid gap-2 text-sm font-medium">Identificador<input name="id" required placeholder="ufpr-propesq" className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Nome da fonte<input name="name" required className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Instituição<input name="institution" required className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Sigla<input name="acronym" className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">Tipo de instituição<select name="source_type" defaultValue="federal_university" className="rounded-lg border border-slate-300 px-4 py-3"><option value="federal_government">Governo federal</option><option value="state_government">Governo estadual</option><option value="government_foundation">Fundação pública</option><option value="federal_university">Universidade federal</option><option value="state_university">Universidade estadual</option><option value="federal_institute">Instituto federal</option><option value="public_research_institution">Instituição pública de pesquisa</option><option value="official_reference">Referência oficial</option></select></label>
        <label className="grid gap-2 text-sm font-medium">Abrangência da fonte<select name="scope" defaultValue="state" className="rounded-lg border border-slate-300 px-4 py-3"><option value="state">UF específica</option><option value="national">Brasil inteiro</option></select></label>
        <p className="text-sm text-slate-600">Para uma fonte nacional, deixe UF e cidade em branco. Confirme a abrangência na auditoria antes de ativá-la.</p>
        <div className="grid gap-5 md:grid-cols-2"><label className="grid gap-2 text-sm font-medium">UF<select name="state_code" defaultValue="" className="rounded-lg border border-slate-300 px-4 py-3"><option value="">Sem UF</option>{BRAZILIAN_STATE_CODES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Cidade vinculada à fonte <span className="font-normal text-slate-500">(opcional)</span><input name="city_name" maxLength={100} className="rounded-lg border border-slate-300 px-4 py-3" /></label></div>
        <label className="grid gap-2 text-sm font-medium">Domínios autorizados<textarea name="domains" required placeholder="www.ufpr.br editais.ufpr.br" className="min-h-24 rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">URLs de listagem oficiais<textarea name="listing_urls" required className="min-h-28 rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">URL oficial de evidência para a auditoria<input name="audit_evidence_url" type="url" required placeholder="https://www.instituicao.br/..." className="rounded-lg border border-slate-300 px-4 py-3" /></label>
        <button className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">Salvar como pendente</button>
      </form>
    </section></main>
  );
}
