import { requireAdmin } from "@/lib/auth/admin";
import { adminRows } from "@/lib/db/read-models";
import { AdminNav } from "../_components/nav";

export const dynamic = "force-dynamic";

interface Run { id: string; official_source_id: string; started_at: string; status: string; pages_checked: number; items_discovered: number; items_created: number; items_failed: number; error_summary: string | null }

export default async function IngestionsPage() {
  await requireAdmin();
  const runs = await adminRows<Run>("select * from ingestion_runs order by started_at desc limit 100");
  return (
    <main className="min-h-screen bg-slate-50"><AdminNav /><section className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Rastreabilidade</p><h1 className="mt-2 text-3xl font-bold">Execuções de ingestão</h1>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm">
        <thead className="bg-slate-100"><tr><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Páginas</th><th className="px-4 py-3">Descobertos</th><th className="px-4 py-3">Criados</th><th className="px-4 py-3">Falhas</th></tr></thead>
        <tbody>{runs.map((run) => <tr key={run.id} className="border-t border-slate-100"><td className="px-4 py-3">{run.official_source_id}</td><td className="px-4 py-3">{run.status}</td><td className="px-4 py-3">{run.pages_checked}</td><td className="px-4 py-3">{run.items_discovered}</td><td className="px-4 py-3">{run.items_created}</td><td className="px-4 py-3">{run.items_failed}</td></tr>)}</tbody>
      </table>{!runs.length ? <p className="p-8 text-center text-slate-500">Nenhuma execução registrada.</p> : null}</div>
    </section></main>
  );
}