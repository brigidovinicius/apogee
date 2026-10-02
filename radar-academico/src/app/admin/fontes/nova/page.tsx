import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "../../_components/nav";
import { createSource } from "../actions";

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
        <label className="grid gap-2 text-sm font-medium">Domínios autorizados<textarea name="domains" required placeholder="www.ufpr.br editais.ufpr.br" className="min-h-24 rounded-lg border border-slate-300 px-4 py-3" /></label>
        <label className="grid gap-2 text-sm font-medium">URLs de listagem oficiais<textarea name="listing_urls" required className="min-h-28 rounded-lg border border-slate-300 px-4 py-3" /></label>
        <button className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">Salvar como pendente</button>
      </form>
    </section></main>
  );
}