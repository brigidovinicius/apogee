import { radarAccess } from "@/lib/billing/store";
import { radarMonthlyState } from "@/lib/opportunities/detail-store";
import { MonthlyQuota } from "@/components/community/radar-quota";
import { CalendarSaveProvider } from "@/components/opportunities/save-opportunity";
import { calendarSaveState } from "@/lib/opportunities/personal-calendar";
import { calendarReturnPath } from "@/lib/opportunities/calendar-navigation";
import type { Metadata } from "next";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import styles from "@/components/members/members.module.css";
import { RadarTabs } from "@/components/opportunities/radar-tabs";
import { requireSignedInMember } from "@/lib/members/dal";
import { listMemberOpportunityPage } from "@/lib/opportunities/access";
import { memberRadarPath } from "@/lib/opportunities/navigation";
import { RadarAmplitude } from "@/components/analytics/radar-amplitude";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Radar de oportunidades",
  description: "Empregos, eventos e oportunidades para membros da comunidade Apogee.",
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
  const quota = access.active ? null : await radarMonthlyState(member.id);
  const catalogue = await listMemberOpportunityPage(params).catch(() => null);

  const returnTo=calendarReturnPath('/membros/oportunidades?'+params);
  const saveState=await calendarSaveState(catalogue?.opportunities.map(item=>item.id)??[],returnTo);

  return (
    <MemberWorkspace member={member} current="radar"><div className={styles.container}>

      <header data-ap-radar-hero="member" className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Radar de oportunidades</h1>
          <p className={styles.lead}>
            Vagas, eventos e programas com fontes oficiais.
          </p>
        </div>
      </header>
      {quota ? <MonthlyQuota quota={quota} area="Radar" next={returnTo} /> : <p>Radar completo ativo.</p>}
      <RadarTabs current="catalogue" calendar={saveState.kind === "ready"}
        collections={saveState.kind === "ready" && Boolean(saveState.collections)} />
      {catalogue ? <RadarAmplitude view="radar_list_viewed" memberId={member.id} /> : null}
      {catalogue ? <CalendarSaveProvider key={JSON.stringify([returnTo,saveState])} state={saveState} returnTo={returnTo}><OpportunitiesBoard opportunities={catalogue.opportunities} catalogue={catalogue} showCalendarLink editorialFeed /></CalendarSaveProvider> : <p role="alert">Catálogo temporariamente indisponível. Tente novamente em instantes</p>}
    </div></MemberWorkspace>
  );
}
