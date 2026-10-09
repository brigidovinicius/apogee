"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BrazilianStateCode } from "@/lib/location";

type LocationFiltersProps = {
  states: BrazilianStateCode[];
  cities: string[];
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
};

export function LocationFilters({ states, cities, stateCode, cityName }: LocationFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const replace = (nextState: string | null, nextCity: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextState) params.set("uf", nextState);
    else params.delete("uf");
    if (nextState && nextCity) params.set("cidade", nextCity);
    else params.delete("cidade");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="monitor-state">
        Estado/UF
        <select
          id="monitor-state"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal"
          value={stateCode ?? ""}
          aria-controls="monitor-city"
          onChange={(event) => replace(event.target.value || null, null)}
        >
          <option value="">Todos os estados</option>
          {states.map((state) => <option key={state} value={state}>{state}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="monitor-city">
        Cidade
        <select
          id="monitor-city"
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal disabled:cursor-not-allowed disabled:bg-slate-100"
          value={cityName && cities.includes(cityName) ? cityName : ""}
          disabled={!stateCode || cities.length === 0}
          onChange={(event) => replace(stateCode, event.target.value || null)}
        >
          <option value="">Todas as cidades</option>
          {cities.map((city) => <option key={`${stateCode}-${city}`} value={city}>{city}</option>)}
        </select>
      </label>
      <button
        type="button"
        className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!stateCode && !cityName}
        onClick={() => replace(null, null)}
      >
        Limpar filtros
      </button>
    </div>
  );
}
