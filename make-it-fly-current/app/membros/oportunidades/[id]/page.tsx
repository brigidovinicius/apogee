import { personalCalendarEnabled, savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { toggleSaved } from "@/app/membros/meu-calendario/actions";
import Link from "next/link";
import { formatCalendarDate } from "@/components/opportunities/calendar-list";
import { MemberBar } from "@/components/members/member-bar";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { AutomaticDetailOpening } from "@/components/opportunities/automatic-detail-opening";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { adultAccess } from "@/lib/members/protection";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { openFreeOpportunity } from "./actions";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhes da oportunidade | Apogee", robots: { index: false, follow: false } };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await radarOpportunityDetail(id);
  const hasCalendar = personalCalendarEnabled() && result.status === "unlimited";
  const canSave = hasCalendar && await adultAccess(result.member.id);
  const saved = canSave ? (await savedOpportunities(result.member.id)).some(s=>s.id===id && !s.removedAt) : false;
  return <div className={styles.container}>
    <MemberBar member={result.member} current="radar" />
    <div className={styles.opportunityDetail}>
      <p><Link href="/membros/oportunidades">← Voltar ao Radar</Link></p>
      {result.opportunity ? <>
        <h1 className={styles.title}>{result.opportunity.title}</h1>
        <OpportunityCard opportunity={result.opportunity} detailed />
        {canSave ? <form action={toggleSaved.bind(null,id,saved)}><button className={styles.primary}>{saved ? "Remover dos salvos" : "Salvar no meu calendário"}</button><Link href="/membros/meu-calendario"> Meu calendário</Link></form> : hasCalendar ? <p>Para usar o calendário pessoal, <Link href="/membros/protecao">conclua a verificação da conta</Link>.</p> : null}
        {result.opportunity.discovery?.editions.map(edition=><section key={edition.id}><h2>{edition.name}</h2><ol>{edition.stages.map(stage=><li key={stage.id}><strong>{stage.name}</strong>: <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null} · <a href={stage.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte oficial</a></li>)}</ol></section>)}
      </> : <AutomaticDetailOpening
        key={`${id}:${result.status}`}
        checkout={result.status === "purchase"}
        action={result.status === "purchase"
          ? `/api/radar/checkout?next=${encodeURIComponent(opportunityDetailPath(id))}`
          : openFreeOpportunity.bind(null, id)}
      />}
    </div>
  </div>;
}
