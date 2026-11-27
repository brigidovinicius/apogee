import { personalCalendarEnabled, savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { toggleSaved } from "@/app/membros/meu-calendario/actions";
import Link from "next/link";
import { formatCalendarDate } from "@/components/opportunities/calendar-list";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { MonthlyQuota } from "@/components/community/radar-quota";
import { memberRadarPath } from "@/lib/opportunities/navigation";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath, radarDetailQuery } from "@/lib/opportunities/detail-path";
import { RADAR_FOR_YOU } from "@/lib/opportunities/radar-preferences";
import { openFreeOpportunity } from "./actions";
import styles from "@/components/members/members.module.css";
import { RadarAmplitude } from "@/components/analytics/radar-amplitude";

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
  const saved = hasCalendar ? (await savedOpportunities(result.member.id)).some(s=>s.id===id && !s.removedAt) : false;
  return <MemberWorkspace member={result.member} current="radar"><div className={styles.container}>

    <div className={styles.opportunityDetail}>
      <p><Link href={query.get("origem") === "para-voce" ? RADAR_FOR_YOU : memberRadarPath(query)}>← Voltar ao Radar</Link></p>
      <h1 className={styles.title}>{result.title}</h1>
      {result.quota ? <MonthlyQuota quota={result.quota} area="Radar" next={detailPath} /> : null}
      {result.opportunity ? <>
        <RadarAmplitude key={id} view="radar_detail_viewed" memberId={result.member.id} />
        <OpportunityCard opportunity={result.opportunity} detailed />
        {hasCalendar ? <form data-behavior-action={saved ? "remove_saved" : "save"} action={toggleSaved.bind(null,id,saved)}><button className={styles.primary}>{saved ? "Remover dos salvos" : "Salvar no meu calendário"}</button><Link href="/membros/meu-calendario"> Meu calendário</Link></form> : null}
        {result.opportunity.discovery?.editions.map(edition=><section key={edition.id}><h2 data-ap-heading="">{edition.name}</h2><ol>{edition.stages.map(stage=><li key={stage.id}><strong>{stage.name}</strong>: <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null} · <a data-behavior-action="official_link" href={stage.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte oficial</a></li>)}</ol></section>)}
      </> : result.status === "purchase" ? <p><Link href={`/membros/radar/acesso?next=${encodeURIComponent(detailPath)}`}>Já tenho acesso ao Radar</Link></p> : <section className={styles.panel} aria-labelledby="free-detail-title">
        <h2 data-ap-heading="" id="free-detail-title">Consultar detalhes</h2>
        <p>Abrir usa uma consulta do Radar. Reabrir no mesmo mês não usa outra.</p>
        <form action={openFreeOpportunity.bind(null, id, radarDetailQuery(query))}>
          <button className={styles.primary} type="submit">Usar consulta gratuita</button>
        </form>
      </section>}

    </div>
  </div></MemberWorkspace>;
}
