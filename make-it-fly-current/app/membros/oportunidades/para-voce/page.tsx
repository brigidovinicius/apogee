import Link from "next/link";
import { MemberWorkspace } from "@/components/members/member-workspace";
import personal from "@/components/members/radar-personalization.module.css";
import styles from "@/components/members/members.module.css";
import { OpportunityCard } from "@/components/opportunities/opportunities-board";
import { RadarTabs } from "@/components/opportunities/radar-tabs";
import { CalendarSaveProvider } from "@/components/opportunities/save-opportunity";
import { requireSignedInMember } from "@/lib/members/dal";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { calendarSaveState } from "@/lib/opportunities/personal-calendar";
import { matchRadarProfile } from "@/lib/opportunities/profile-match";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { dismissedRadarOpportunities, getRadarPreference } from "@/lib/opportunities/radar-preference-store";
import { RADAR_FOR_YOU, RADAR_PREFERENCES } from "@/lib/opportunities/radar-preferences";
import { dismissRecommendation } from "./actions";

export const metadata = { title: "Para você · Radar", robots: { index: false, follow: false } };

export default async function RadarForYouPage() {
  const member = await requireSignedInMember(RADAR_FOR_YOU);
  const preference = await getRadarPreference(member.id);
  const catalogue = preference ? await listRadarOpportunities().catch(() => null) : null;
  const matches = catalogue && preference
    ? matchRadarProfile(catalogue, preference.settings, await dismissedRadarOpportunities(member.id)).slice(0, 12)
    : [];
  const saveState = await calendarSaveState(matches.map(({ opportunity }) => opportunity.id), RADAR_FOR_YOU);
  const fromRecommendations = new URLSearchParams({ origem: "para-voce" });

  return <MemberWorkspace member={member} current="radar">
    <div className={`${styles.container} ${personal.page}`}>
      <header data-ap-radar-hero="member" className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Para você</h1>
          <p className={styles.lead}>Oportunidades do Radar que combinam com seu perfil e seus interesses.</p>
        </div>
        {preference && <Link href={RADAR_PREFERENCES} data-ap-button="secondary">Editar preferências</Link>}
      </header>
      <RadarTabs current="for-you" calendar={saveState.kind === "ready"}
        collections={saveState.kind === "ready" && Boolean(saveState.collections)} />
      {!preference ? <section className={styles.panel}>
        <h2>O que você quer encontrar?</h2>
        <p>Conte o que você estuda, faz ou acompanha para ver recomendações aqui.</p>
        <Link href={RADAR_PREFERENCES} data-ap-button="primary">Configurar meu Radar</Link>
      </section> : !catalogue ? <p role="alert">O Radar está temporariamente indisponível. Tente novamente em instantes.</p>
        : !matches.length ? <section className={styles.panel}>
          <h2>Nenhuma oportunidade compatível agora</h2>
          <p>Explore o catálogo ou ajuste suas preferências para ampliar a busca.</p>
          <Link href="/membros/oportunidades" data-ap-button="secondary">Explorar catálogo</Link>
        </section>
          : <CalendarSaveProvider key={JSON.stringify(saveState)} state={saveState} returnTo={RADAR_FOR_YOU}>
            <div className={personal.recommendations}>
              {matches.map(({ opportunity, reason, checkRequirements }) => (
                <div key={opportunity.id} className={personal.recommendation}>
                  <OpportunityCard opportunity={opportunityCardData(opportunity)}
                    detailHref={opportunityDetailPath(opportunity.id, fromRecommendations)}
                    recommendation={<p className={personal.reason}>{reason}{checkRequirements ? " Confira os requisitos na ficha." : ""}</p>} />
                  <form action={dismissRecommendation.bind(null, opportunity.id)}>
                    <button type="submit" data-ap-button="secondary" aria-label={`Não é para mim: ${opportunity.title}`}>Não é para mim</button>
                  </form>
                </div>
              ))}
            </div>
          </CalendarSaveProvider>}
    </div>
  </MemberWorkspace>;
}
