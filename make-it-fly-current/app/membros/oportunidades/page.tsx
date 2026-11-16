import { radarAccess } from "@/lib/billing/store";
import { freeRadarState } from "@/lib/opportunities/detail-store";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { RadarQuota } from "@/components/community/radar-quota";
import { CalendarSaveProvider } from "@/components/opportunities/save-opportunity";
import { calendarSaveState } from "@/lib/opportunities/personal-calendar";
import { calendarReturnPath } from "@/lib/opportunities/calendar-navigation";
import type { Metadata } from "next";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import styles from "@/components/members/members.module.css";
import { requireSignedInMember } from "@/lib/members/dal";
import { listMemberOpportunityPage } from "@/lib/opportunities/access";
import { memberRadarPath } from "@/lib/opportunities/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar de oportunidades",
  description: "Oportunidades estudantis completas para membros da comunidade Apogee.",
};

export default async function MemberOpportunitiesPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  // A DAL repete a autenticação antes de ler o catálogo de cards.
  const member = await requireSignedInMember(memberRadarPath(params));
  const access = await radarAccess(member.id,process.env.STRIPE_MODE !== "test");
  const fullCatalogue = access.active ? null : await listRadarOpportunities(true).catch(()=>null);
  const quota = fullCatalogue ? await freeRadarState(member.id,fullCatalogue) : null;
  const catalogue = await listMemberOpportunityPage(params).catch(() => null);

  const returnTo=calendarReturnPath('/membros/oportunidades?'+params);
  const saveState=await calendarSaveState(catalogue?.opportunities.map(item=>item.id)??[],returnTo);

  return (
    <MemberWorkspace member={member} current="radar"><div className={styles.container}>

      <header className={styles.pageHead}>
        <div>
          <p className={styles.eyebrow}>Oportunidades</p>
          <h1 className={styles.title}>Radar de oportunidades</h1>
          <p className={styles.lead}>
            Encontre eventos, programas e oportunidades para participar.
          </p>
        </div>
      </header>
      {quota ? <RadarQuota used={quota.used} limit={quota.limit} /> : access.active ? <p>Seu acesso ao Radar completo está ativo.</p> : null}
      {catalogue ? <CalendarSaveProvider key={JSON.stringify([returnTo,saveState])} state={saveState} returnTo={returnTo}><OpportunitiesBoard opportunities={catalogue.opportunities} catalogue={catalogue} editorialFeed /></CalendarSaveProvider> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes</p>}
    </div></MemberWorkspace>
  );
}
