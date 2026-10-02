import Link from "next/link";
import { listPublicOpportunities } from "@/lib/db/read-models";

const coverage = process.env.NEXT_PUBLIC_COVERAGE_LABEL ??
  "Beta: UFSC, oportunidades de Santa Catarina e programas nacionais selecionados";

function routeLabel(route: string) {
  if (route === "application_via_professor") return "Candidatura via professor";
  if (route === "application_via_university" || route === "institutional_call") return "Candidatura via instituição";
  return "Candidatura direta";
}

export default async function Home() {
  const opportunities = await listPublicOpportunities();
  return (
    <main>
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold text-slate-950">Radar Acadêmico</Link>
          <Link href="/admin/fontes" className="text-sm font-medium text-slate-600 hover:text-blue-700">Admin</Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-12 pt-16">
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">{coverage}</span>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
          Oportunidades acadêmicas com origem que você pode conferir.
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
          Oportunidades públicas provenientes de fontes oficiais, reunidas, verificadas e organizadas em um só lugar.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Oportunidades abertas</p>
            <h2 className="mt-2 text-3xl font-bold text-slate-950">Revisadas pela equipe</h2>
          </div>
          <span className="text-sm text-slate-500">{opportunities.length} publicada(s)</span>
        </div>

        {opportunities.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {opportunities.map((item) => (
              <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-800">Fonte oficial</span>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-800">Revisado pela equipe</span>
                  {item.has_retification ? <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-800">Possui retificação</span> : null}
                </div>
                <p className="mt-5 text-sm font-medium text-slate-500">{item.institution}</p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-4 text-sm text-slate-600">{routeLabel(item.application_route)}</p>
                <Link href={`/oportunidades/${item.id}`} className="mt-6 inline-flex font-semibold text-blue-700 hover:underline">Ver detalhes</Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h3 className="text-xl font-semibold text-slate-900">Nenhuma oportunidade publicada ainda</h3>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600">
              Itens coletados só aparecem aqui depois da conferência da fonte, do prazo, do público e do caminho de candidatura.
            </p>
          </div>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-300">
        <div className="mx-auto max-w-6xl px-6 py-10 text-sm leading-6">
          O Radar Acadêmico reúne informações públicas de fontes oficiais. A plataforma não possui vínculo com as instituições divulgadas, não participa dos processos seletivos e não garante aprovação. Em caso de divergência, prevalecem o edital, as retificações e as informações publicadas pela instituição responsável.
        </div>
      </footer>
    </main>
  );
}