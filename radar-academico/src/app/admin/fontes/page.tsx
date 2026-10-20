import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { officialSourceRegistry } from "@/lib/official-sources/registry";
import { AdminNav } from "../_components/nav";
import { runIngestion, toggleSource } from "./actions";
import { adminRows } from "@/lib/db/read-models";
import { BRAZILIAN_STATE_CODES } from "@/lib/location";

export const dynamic = "force-dynamic";

type SourceRecord = {
  id: string; name: string; institution_name: string; extraction_mode: string;
  state_code: string | null; city_name: string | null; active: boolean;
  verification_status: "pending" | "verified" | "rejected"; priority: number;
  geographic_scope: string[];
};

const automaticModes = new Set(["rss", "html"]);

export default async function SourcesPage() {
  await requireAdmin();
  const persisted = await adminRows<SourceRecord>(
    "select id,name,institution_name,extraction_mode,state_code,city_name,geographic_scope,active,verification_status,priority from official_sources order by state_code nulls last, city_name nulls last, priority desc, name",
  );
  const sources = persisted.length || process.env.DATABASE_EDITOR_URL ? persisted : officialSourceRegistry.map((source) => ({
    id: source.id, name: source.name, institution_name: source.institutionName, extraction_mode: source.extractionMode,
    state_code: source.location?.stateCode ?? null, city_name: source.location?.cityName ?? null,
    geographic_scope: source.geographicScope,
    active: source.active, verification_status: "pending" as const, priority: source.priority,
  }));
  const automaticSources = sources.filter((source) => source.active && source.verification_status === "verified" && automaticModes.has(source.extraction_mode));
  const nationalSources = automaticSources.filter((source) => source.geographic_scope.includes("Brasil")).length;
  const coveredStates = new Set(automaticSources.map((source) => source.state_code).filter(Boolean));
  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />
      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Administração</p><h1 className="mt-2 text-3xl font-bold text-slate-950">Fontes oficiais</h1><p className="mt-2 max-w-2xl text-slate-600">Cada fonte passa por evidência oficial, confirmação da UF e ativação manual antes de qualquer coleta.</p></div>
          <Link href="/admin/fontes/nova" className="rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold">Nova fonte</Link>
        </div>
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6" aria-labelledby="source-coverage-title">
          <h2 id="source-coverage-title" className="text-xl font-bold">Cobertura das fontes automáticas</h2>
          <p className="mt-2 text-sm text-slate-600">{coveredStates.size} de 27 UFs com fonte local ativa e verificada · {nationalSources} fontes nacionais. Esta contagem mede fontes configuradas, não oportunidades encontradas em cada cidade.</p>
          <ul className="mt-4 grid grid-cols-5 gap-2 text-center text-sm sm:grid-cols-9" aria-label="Cobertura por UF">
            {BRAZILIAN_STATE_CODES.map((code) => <li key={code} className={`rounded-lg px-2 py-2 font-semibold ${coveredStates.has(code) ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-600"}`} title={coveredStates.has(code) ? "Fonte automática ativa" : "Sem fonte automática ativa"}>{code}</li>)}
          </ul>
        </section>
        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600"><tr><th className="px-5 py-4">Fonte</th><th className="px-5 py-4">Cobertura</th><th className="px-5 py-4">Auditoria</th><th className="px-5 py-4">Coleta controlada</th></tr></thead>
            <tbody>{sources.map((source) => {
              const collectable = source.active && source.verification_status === "verified" && automaticModes.has(source.extraction_mode);
              return <tr key={source.id} className="border-t border-slate-100 align-top">
                <td className="px-5 py-4"><Link href={`/admin/fontes/${source.id}`} className="font-semibold text-blue-700 hover:underline">{source.name}</Link><p className="mt-1 text-xs text-slate-500">{source.institution_name} · {source.extraction_mode}</p></td>
                <td className="px-5 py-4">{source.state_code ?? (source.geographic_scope.includes("Brasil") ? "Brasil" : "Não informada")}{source.city_name ? ` · ${source.city_name}` : ""}</td>
                <td className="px-5 py-4"><span className={source.verification_status === "verified" ? "font-semibold text-emerald-700" : source.verification_status === "rejected" ? "font-semibold text-red-700" : "font-semibold text-amber-700"}>{source.verification_status === "verified" ? "Verificada" : source.verification_status === "rejected" ? "Rejeitada" : "Pendente"}</span><p className="mt-1 text-xs text-slate-500">{source.active ? "Ativa" : "Inativa"}</p>{process.env.DATABASE_EDITOR_URL ? <form action={toggleSource} className="mt-2"><input type="hidden" name="id" value={source.id} /><input type="hidden" name="active" value={String(!source.active)} /><button className="text-xs font-semibold text-blue-700">{source.active ? "Desativar" : "Ativar"}</button></form> : null}</td>
                <td className="px-5 py-4">{collectable ? <form action={runIngestion} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={source.id} /><label className="grid gap-1 text-xs">Páginas<input name="max_pages" type="number" min="2" max="10" defaultValue="5" className="w-16 rounded border border-slate-300 px-2 py-1" /></label><label className="grid gap-1 text-xs">Candidatos<input name="max_candidates" type="number" min="1" max="10" defaultValue="10" className="w-16 rounded border border-slate-300 px-2 py-1" /></label><button className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Coletar</button></form> : <span className="text-xs text-slate-500">{automaticModes.has(source.extraction_mode) ? "Exige auditoria e ativação" : "Revisão manual"}</span>}</td>
              </tr>;
            })}</tbody>
          </table>
          {!sources.length ? <p className="p-8 text-center text-slate-500">Nenhuma fonte cadastrada. Cadastre a primeira fonte com evidência oficial e abrangência confirmada.</p> : null}
        </div>
      </section>
    </main>
  );
}
