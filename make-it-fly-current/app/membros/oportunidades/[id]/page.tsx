import Link from "next/link";
import { redirect } from "next/navigation";
import { MemberBar } from "@/components/members/member-bar";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { radarOpportunityDetail } from "@/lib/opportunities/detail-access";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { openFreeOpportunity } from "./actions";
import styles from "@/components/members/members.module.css";
import detailStyles from "./detail.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Detalhes da oportunidade | Apogee", robots: { index: false, follow: false } };

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await radarOpportunityDetail(id);
  if (result.status === "purchase") redirect(`${RADAR_ACCESS_PATH}?next=${encodeURIComponent(opportunityDetailPath(id))}&from=detail`);
  return <div className={styles.container}>
    <MemberBar member={result.member} current="radar" />
    <div className={styles.narrow}>
      <header className={detailStyles.header}>
        <Link className={detailStyles.backLink} href="/membros/oportunidades">← Voltar ao Radar</Link>
        <h1 className={styles.title}>{result.opportunity ? result.opportunity.title : "Sua primeira oportunidade é grátis"}</h1>
      </header>
      {result.opportunity ? <>
        {result.status === "free" ? <p>Esta é sua oportunidade gratuita. Você pode voltar a ela quando quiser enquanto estiver disponível.</p> : null}
        <OpportunityCard opportunity={result.opportunity} detailed />
      </> : <>
        <p><strong>{result.title}</strong></p>
        <p className={styles.lead}>Use seu acesso gratuito para abrir os detalhes desta oportunidade. Ela continuará disponível para você enquanto estiver no Radar.</p>
        <p>Para acessar uma segunda oportunidade diferente, o acesso vitalício custa R$ 49,00 em pagamento único.</p>
        <form action={openFreeOpportunity.bind(null, id)}>
          <button type="submit" className={styles.primary}>Abrir esta oportunidade grátis</button>
        </form>
      </>}
    </div>
  </div>;
}
