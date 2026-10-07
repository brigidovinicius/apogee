import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { officialSourceRegistry } from "@/lib/official-sources/registry";
import { AdminNav } from "../_components/nav";
import { runIngestion, toggleSource } from "./actions";
import { adminRows } from "@/lib/db/read-models";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await requireAdmin();
  const persisted = await adminRows<{ id: string; active: boolean }>("select id,active from official_sources");
  const activeById = new Map(persisted.map((item) => [item.id, item.active]));
  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Administração</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Fontes oficiais</h1></div>
          <div className="flex gap-3"><Link href="/admin/fontes/nova" className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold">Nova fonte</Link><form action={runIngestion}><button className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white">Executar coleta manual</button></form></div>
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-5 py-4">Fonte</th><th className="px-5 py-4">Modo</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Prioridade</th></tr></thead>
            <tbody>
              {officialSourceRegistry.map((source) => {
                const active = activeById.get(source.id) ?? source.active;
                return (
                <tr key={source.id} className="border-t border-slate-100">
                  <td className="px-5 py-4"><Link href={`/admin/fontes/${source.id}`} className="font-semibold text-blue-700 hover:underline">{source.name}</Link><p className="mt-1 text-xs text-slate-500">{source.institutionName}</p></td>
                  <td className="px-5 py-4">{source.extractionMode}</td>
                  <td className="px-5 py-4"><span className={active ? "text-emerald-700" : "text-slate-500"}>{active ? "Ativa" : "Inativa"}</span>{process.env.DATABASE_URL ? <form action={toggleSource} className="mt-2"><input type="hidden" name="id" value={source.id} /><input type="hidden" name="active" value={String(!active)} /><button className="text-xs font-semibold text-blue-700">{active ? "Desativar" : "Ativar"}</button></form> : null}</td>
                  <td className="px-5 py-4">{source.priority}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        {!process.env.DATABASE_URL ? <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Banco não configurado neste ambiente. O registro tipado está disponível, mas alterações persistentes e coletas ficam desativadas.</p> : null}
      </section>
    </main>
  );
}