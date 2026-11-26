import Link from "next/link";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { AreaIcon } from "@/components/site/area-icon";
import shared from "@/components/members/members.module.css";
import styles from "@/components/eventos/eventos.module.css";
import { requireSignedInMember } from "@/lib/members/dal";
import { EVENTS_PATH, mediaEvents, upcomingEvents } from "@/lib/eventos/catalogo";

export const metadata = { title: "Eventos" };

export default async function EventsPage() {
  const member = await requireSignedInMember(EVENTS_PATH);
  return <MemberWorkspace member={member} current="eventos">
    <div className={`${shared.container} ${styles.page}`}>
      <header className={styles.heading}><AreaIcon area="eventos" /><h1 className={shared.title}>Eventos</h1></header>
      <section className={styles.section} aria-labelledby="proximos">
        <h2 id="proximos" data-ap-title="">Próximos eventos</h2>
        {upcomingEvents.length ? <div className={styles.cards}>{upcomingEvents.map(event =>
          <article data-ap-card="" className={styles.panel} key={event.slug}>
            <h3>{event.title}</h3><p>{event.dateLabel} · {event.location}</p>
            <a href={event.registration} data-ap-button="primary">Inscrever-se</a>
          </article>)}</div> : <div data-ap-card="" className={styles.panel}><p>Ainda não há novos eventos anunciados.</p></div>}
      </section>
      <section className={styles.section} aria-labelledby="midias">
        <h2 id="midias" data-ap-title="">Mídias dos eventos</h2>
        <div className={styles.cards}>{mediaEvents.map(event => <article data-ap-card="" className={styles.panel} key={event.slug}>
          <h3>{event.title}</h3>
          <p><time dateTime={event.startsAt}>{event.dateLabel}</time> · {event.location}</p>
          <Link href={`${EVENTS_PATH}/${event.slug}`} data-ap-button="primary" prefetch={false}>Abrir mídias do evento</Link>
        </article>)}</div>
      </section>
    </div>
  </MemberWorkspace>;
}
