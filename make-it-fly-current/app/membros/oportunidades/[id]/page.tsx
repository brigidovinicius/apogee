import { personalCalendarEnabled, savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { toggleSaved } from "@/app/membros/meu-calendario/actions";
import Link from "next/link";
import { formatCalendarDate } from "@/components/opportunities/calendar-list";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { MonthlyQuota } from "@/components/community/radar-quota";
import { memberRadarPath, radarCatalogueQuery } from "@/lib/opportunities/navigation";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { adultAccess } from "@/lib/members/protection";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { openFreeOpportunity } from "./actions";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhes da oportunidade | Apogee", robots: { index: false, follow: false } };

export default async function OpportunityDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const detailPath = opportunityDetailPath(id, query);
  const result = await radarOpportunityDetail(id, false, query);
  const hasCalendar = personalCalendarEnabled() && result.status === "unlimited";
  const canSave = hasCalendar && await adultAccess(result.member.id);
  const saved = canSave ? (await savedOpportunities(result.member.id)).some(s=>s.id===id && !s.removedAt) : false;
  return <MemberWorkspace member={result.member} current="radar"><div className={styles.container}>

    <div className={styles.opportunityDetail}>
      <p><Link href={memberRadarPath(query)}>← Voltar ao Radar</Link></p>
      <h1 className={styles.title}>{result.title}</h1>
      {result.quota ? <MonthlyQuota quota={result.quota} area="Radar" next={detailPath} /> : null}
      {result.opportunity ? <>
        <OpportunityCard opportunity={result.opportunity} detailed />
        {canSave ? <form data-behavior-action={saved ? "remove_saved" : "save"} action={toggleSaved.bind(null,id,saved)}><button className={styles.primary}>{saved ? "Remover dos salvos" : "Salvar no meu calendário"}</button><Link href="/membros/meu-calendario"> Meu calendário</Link></form> : hasCalendar ? <p>Para usar o calendário pessoal, <Link href={`/membros/protecao?next=${encodeURIComponent(detailPath)}`}>conclua a verificação da conta</Link>.</p> : null}
        {result.opportunity.discovery?.editions.map(edition=><section key={edition.id}><h2>{edition.name}</h2><ol>{edition.stages.map(stage=><li key={stage.id}><strong>{stage.name}</strong>: <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null} · <a data-behavior-action="official_link" href={stage.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte oficial</a></li>)}</ol></section>)}
      </> : result.status === "purchase" ? <p><Link href={`/membros/radar/acesso?next=${encodeURIComponent(detailPath)}`}>Já tenho acesso ao Radar</Link></p> : <section className={styles.panel} aria-labelledby="free-detail-title">
        <h2 id="free-detail-title">Consultar detalhes</h2>
        <p>Abrir esta oportunidade usa uma consulta do Radar. Você pode reabri-la no mesmo mês sem usar outra.</p>
        <form action={openFreeOpportunity.bind(null, id, radarCatalogueQuery(query))}>
          <button className={styles.primary} type="submit">Usar consulta gratuita</button>
        </form>
      </section>}

    </div>
  </div></MemberWorkspace>;
}
