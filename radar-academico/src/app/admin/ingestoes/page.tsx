import { requireAdmin } from "@/lib/auth/admin";
import { adminRows, getLocationMonitoring } from "@/lib/db/read-models";
import { normalizeBrazilianLocation } from "@/lib/location";
import { AdminNav } from "../_components/nav";
import { LocationFilters } from "./location-filters";

export const dynamic = "force-dynamic";

interface Run {
  id: string;
  official_source_id: string;
  started_at: string;
  status: string;
  pages_checked: number;
  items_discovered: number;
  items_created: number;
  items_failed: number;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default async function IngestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ uf?: string | string[]; cidade?: string | string[] }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const normalized = normalizeBrazilianLocation({
    stateCode: first(params.uf),
    cityName: first(params.cidade),
  });
  const filters = normalized.status === "valid"
    ? normalized.location
    : { stateCode: null, cityName: null };
  const [runs, location] = await Promise.all([
    adminRows<Run>("select * from ingestion_runs order by started_at desc limit 100"),
    getLocationMonitoring(filters),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <AdminNav />
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Rastreabilidade</p>
        <h1 className="mt-2 text-3xl font-bold">Execuções de ingestão</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Cobertura agregada de campos estruturados. Localizações ausentes permanecem ausentes; esta tela não interpreta títulos, editais ou endereços.
        </p>

        {location.available ? (
          <section className="mt-8" aria-labelledby="location-coverage-title">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Qualidade dos dados</p>
                <h2 id="location-coverage-title" className="mt-1 text-2xl font-bold">Cobertura de localização</h2>
              </div>
              <p className="text-sm text-slate-500">
                Última atualização: {location.lastUpdatedAt ? dateTime.format(new Date(location.lastUpdatedAt)) : "não disponível"}
              </p>
            </div>

            <LocationFilters
              states={location.states}
              cities={location.cities}
              stateCode={filters.stateCode}
              cityName={filters.cityName}
            />

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Registros" value={location.total} />
              <Metric label="No filtro" value={location.filtered} />
              <Metric label="Sem localização" value={location.missing} />
              <Metric label="Inválidos armazenados" value={location.invalidStored} />
              <Metric label="Rejeitados na ingestão" value={location.rejectedDuringIngestion ?? "Sem telemetria"} />
            </dl>

            <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Contagens de oportunidades por UF e cidade</caption>
                <thead className="bg-slate-100">
                  <tr><th className="px-4 py-3">UF</th><th className="px-4 py-3">Cidade</th><th className="px-4 py-3 text-right">Registros</th></tr>
                </thead>
                <tbody>
                  {location.breakdown.map((row) => (
                    <tr key={`${row.stateCode ?? "missing"}-${row.cityName ?? "missing"}`} className="border-t border-slate-100">
                      <td className="px-4 py-3">{row.stateCode ?? "Não informada"}</td>
                      <td className="px-4 py-3">{row.cityName ?? "Não informada"}</td>
                      <td className="px-4 py-3 text-right font-semibold">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!location.breakdown.length ? (
                <p className="p-8 text-center text-slate-500" role="status">Nenhum registro corresponde aos filtros de localização.</p>
              ) : null}
            </div>
          </section>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600" role="status">
            Cobertura de localização indisponível sem conexão configurada com o banco do Radar.
          </p>
        )}

        <section className="mt-10" aria-labelledby="runs-title">
          <h2 id="runs-title" className="text-2xl font-bold">Últimas execuções</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-100"><tr><th className="px-4 py-3">Fonte</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Páginas</th><th className="px-4 py-3">Descobertos</th><th className="px-4 py-3">Criados</th><th className="px-4 py-3">Falhas</th></tr></thead>
              <tbody>{runs.map((run) => <tr key={run.id} className="border-t border-slate-100"><td className="px-4 py-3">{run.official_source_id}</td><td className="px-4 py-3">{run.status}</td><td className="px-4 py-3">{run.pages_checked}</td><td className="px-4 py-3">{run.items_discovered}</td><td className="px-4 py-3">{run.items_created}</td><td className="px-4 py-3">{run.items_failed}</td></tr>)}</tbody>
            </table>
            {!runs.length ? <p className="p-8 text-center text-slate-500">Nenhuma execução registrada.</p> : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 text-2xl font-bold text-slate-950">{value}</dd>
    </div>
  );
}
