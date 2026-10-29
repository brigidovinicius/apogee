import { personalCalendarEnabled, savedOpportunities } from "@/lib/opportunities/personal-calendar";
import { toggleSaved } from "@/app/membros/meu-calendario/actions";
import Link from "next/link";
import { formatCalendarDate } from "@/components/opportunities/calendar-list";
import { redirect } from "next/navigation";
import { MemberBar } from "@/components/members/member-bar";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { openFreeOpportunity } from "./actions";
import styles from "@/components/members/members.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhes da oportunidade | Apogee", robots: { index: false, follow: false } };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await radarOpportunityDetail(id);
  if (result.status === "purchase") redirect(`${RADAR_ACCESS_PATH}?next=${encodeURIComponent(opportunityDetailPath(id))}&from=detail`);
  const saved = personalCalendarEnabled() && result.status === "unlimited" ? (await savedOpportunities(result.member.id)).some(s=>s.id===id && !s.removedAt) : false;
  return <div className={styles.container}>
    <MemberBar member={result.member} current="radar" />
    <div className={styles.narrow}>
      <p><Link href="/membros/oportunidades">← Voltar ao Radar</Link></p>
      {result.opportunity ? <>
        <h1 className={styles.title}>{result.opportunity.title}</h1>
        {result.status === "free" ? <p>Esta é sua oportunidade gratuita. Você pode voltar a ela quando quiser enquanto estiver disponível</p> : null}
        <OpportunityCard opportunity={result.opportunity} detailed />
        {personalCalendarEnabled() && result.status === "unlimited" ? <form action={toggleSaved.bind(null,id,saved)}><button className={styles.primary}>{saved ? "Remover dos salvos" : "Salvar no meu calendário"}</button><Link href="/membros/meu-calendario"> Meu calendário</Link></form> : null}
        {result.opportunity.discovery?.editions.map(edition=><section key={edition.id}><h2>{edition.name}</h2><ol>{edition.stages.map(stage=><li key={stage.id}><strong>{stage.name}</strong>: <time dateTime={stage.start}>{formatCalendarDate(stage.start)}</time>{stage.end ? <> a <time dateTime={stage.end}>{formatCalendarDate(stage.end)}</time></> : null} · <a href={stage.sourceUrl} target="_blank" rel="noopener noreferrer">Fonte oficial</a></li>)}</ol></section>)}
      </> : <>
        <h1 className={styles.title}>Sua primeira oportunidade é grátis</h1>
        <p><strong>{result.title}</strong></p>
        <p className={styles.lead}>Use seu acesso gratuito para abrir os detalhes desta oportunidade. Ela continuará disponível para você enquanto estiver no Radar</p>
        <p>Para acessar uma segunda oportunidade diferente, o acesso vitalício custa R$ 49,00 em pagamento único</p>
        <form action={openFreeOpportunity.bind(null, id)}>
          <button type="submit" className={styles.primary}>Abrir esta oportunidade grátis</button>
        </form>
      </>}
    </div>
  </div>;
}
