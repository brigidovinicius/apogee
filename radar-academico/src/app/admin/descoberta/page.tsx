import { requireAdmin } from "@/lib/auth/admin";
import { listDiscoveryWatchlist } from "@/lib/discovery/watchlist";
import { AdminNav } from "../_components/nav";
import { addAnnualEventEdition, createDiscoveryTarget, reviewDiscoveryLead, toggleDiscoveryTarget } from "./actions";

export const dynamic = "force-dynamic";

const kindName = { site: "Site", program: "Programa", event_series: "Evento anual" };
const statusName = { announced: "Anunciado", past: "Edição passada", cancelled: "Cancelado", unconfirmed: "A confirmar" };

export default async function DiscoveryPage() {
  await requireAdmin();
  const { targets, leads, events } = await listDiscoveryWatchlist();
  return <main className="min-h-screen bg-slate-50">
    <AdminNav />
    <section className="mx-auto max-w-7xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Radar Acadêmico</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">Fontes em observação e agenda anual</h1>
      <p className="mt-3 max-w-3xl text-slate-600">Estas páginas são consultadas diariamente para descobrir links. Um link encontrado não vira ficha pública até que uma fonte oficial e uma inscrição vigente sejam confirmadas.</p>
      <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">{targets.filter((item) => item.enabled).length} páginas em observação · {leads.length} candidatos recentes para análise · {events.length} edições de eventos registradas.</div>

      <section className="mt-10" aria-labelledby="targets-title">
        <h2 id="targets-title" className="text-2xl font-bold">Onde procurar</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[55rem] text-left text-sm"><thead className="bg-slate-100"><tr><th className="p-4">Fonte</th><th className="p-4">Tipo e temas</th><th className="p-4">Última consulta</th><th className="p-4">Busca diária</th></tr></thead><tbody>
            {targets.map((target) => <tr key={target.id} className="border-t border-slate-100 align-top"><td className="p-4"><a className="font-semibold text-blue-700 underline" href={target.official_url} target="_blank" rel="noopener noreferrer">{target.name}</a><p className="mt-1 text-slate-500">{target.organizer}</p></td><td className="p-4">{kindName[target.kind]}<p className="mt-1 text-slate-500">{target.topics.join(", ")}</p></td><td className="p-4">{target.last_checked_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(target.last_checked_at) : "Ainda não consultada"}<p className="mt-1 text-slate-500">{target.last_status === "blocked" ? "Bloqueada ou indisponível" : target.last_status === "checked" ? "Consultada" : target.last_status === "failed" ? "Falha" : "Pendente"}</p></td><td className="p-4"><form action={toggleDiscoveryTarget}><input type="hidden" name="id" value={target.id}/><input type="hidden" name="enabled" value={String(!target.enabled)}/><button className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-blue-700">{target.enabled ? "Pausar" : "Ativar"}</button></form></td></tr>)}
          </tbody></table>
        </div>
        <form action={createDiscoveryTarget} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2">
          <h3 className="text-lg font-bold md:col-span-2">Adicionar site, programa ou evento para observar</h3>
          <label className="grid gap-1 text-sm">Identificador<input name="id" required maxLength={80} placeholder="nome-do-programa" className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Nome<input name="name" required maxLength={200} className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Organizador<input name="organizer" required maxLength={200} className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Tipo<select name="kind" className="rounded border p-2"><option value="site">Site</option><option value="program">Programa</option><option value="event_series">Evento anual</option></select></label>
          <label className="grid gap-1 text-sm">Página oficial<input name="official_url" type="url" required className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Evidência oficial<input name="evidence_url" type="url" required className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm md:col-span-2">Temas, separados por vírgula<input name="topics" placeholder="tecnologia, empreendedorismo" className="rounded border p-2"/></label>
          <p className="text-sm text-slate-500 md:col-span-2">A nova fonte começa pausada. Confira autoria, condições de consulta e abrangência antes de ativar.</p>
          <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white md:col-span-2">Salvar fonte</button>
        </form>
      </section>

      <section className="mt-12" aria-labelledby="events-title"><h2 id="events-title" className="text-2xl font-bold">Agenda de eventos anuais</h2><p className="mt-2 text-slate-600">Uma série pode ter várias edições. Datas antigas e anúncios sem inscrição confirmada não entram no catálogo de oportunidades.</p>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">{events.map((event) => <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-5"><a className="font-semibold text-blue-700 underline" href={event.evidence_url} target="_blank" rel="noopener noreferrer">{event.edition_name}</a><p className="mt-1 text-sm text-slate-600">{event.starts_on ?? "Data a confirmar"}{event.ends_on && event.ends_on !== event.starts_on ? ` a ${event.ends_on}` : ""}{event.location_text ? ` · ${event.location_text}` : ""}</p><p className="mt-2 text-xs font-semibold uppercase text-slate-500">{statusName[event.status]}</p></li>)}</ul>
        <form action={addAnnualEventEdition} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 md:grid-cols-2"><h3 className="text-lg font-bold md:col-span-2">Registrar edição confirmada</h3>
          <label className="grid gap-1 text-sm">Série<select name="target_id" className="rounded border p-2">{targets.filter((target) => target.kind === "event_series").map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label>
          <label className="grid gap-1 text-sm">Ano<input name="edition_year" type="number" min="2020" max="2100" required className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Nome da edição<input name="edition_name" required maxLength={200} className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Situação<select name="status" className="rounded border p-2"><option value="announced">Anunciada</option><option value="unconfirmed">A confirmar</option><option value="past">Passada</option><option value="cancelled">Cancelada</option></select></label>
          <label className="grid gap-1 text-sm">Início<input name="starts_on" type="date" className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Fim<input name="ends_on" type="date" className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Local confirmado<input name="location_text" maxLength={200} className="rounded border p-2"/></label>
          <label className="grid gap-1 text-sm">Página oficial de evidência<input name="evidence_url" type="url" required className="rounded border p-2"/></label>
          <button className="rounded bg-blue-700 px-4 py-3 font-semibold text-white md:col-span-2">Salvar edição</button>
        </form>
      </section>

      <section className="mt-12" aria-labelledby="leads-title"><h2 id="leads-title" className="text-2xl font-bold">Links ainda não mapeados</h2><p className="mt-2 text-slate-600">Até 100 candidatos recentes. A revisão aqui organiza a pesquisa; ela não publica fichas.</p><ul className="mt-4 grid gap-3">{leads.map((lead) => <li key={lead.id} className="rounded-xl border border-slate-200 bg-white p-5"><a href={lead.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline">{lead.title}</a><p className="mt-1 break-all text-xs text-slate-500">{lead.url}</p><p className="mt-1 text-xs text-slate-500">Encontrado em {targets.find((target) => target.id === lead.target_id)?.name ?? lead.target_id} · {lead.status === "new" ? "novo" : "em análise"}</p><div className="mt-3 flex gap-2"><form action={reviewDiscoveryLead}><input type="hidden" name="id" value={lead.id}/><input type="hidden" name="status" value="reviewing"/><button className="rounded border px-3 py-2 text-sm">Em análise</button></form><form action={reviewDiscoveryLead}><input type="hidden" name="id" value={lead.id}/><input type="hidden" name="status" value="dismissed"/><button className="rounded border px-3 py-2 text-sm">Descartar</button></form></div></li>)}</ul>{!leads.length ? <p className="mt-4 rounded-xl bg-white p-5 text-slate-500">Nenhum link novo registrado.</p> : null}</section>
    </section>
  </main>;
}
