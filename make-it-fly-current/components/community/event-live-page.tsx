import Link from "next/link";
import { Check, CirclePlay } from "lucide-react";
import { SiteFooter } from "@/components/site/site-footer";
import { EVENT_LIVE_EMBED, EVENT_LIVE_URL } from "@/lib/community/event-live";
import { FunnelHeader } from "./community-funnel";
import styles from "./community-sales-page.module.css";

const liveTitle = "Transmissão ao vivo do Codex Community Workshop";

export function EventLivePage({ registered }: { registered: boolean }) {
  return <div className={styles.page} data-recording-page>
    <FunnelHeader page="recording" />
    <main id="experiencia" tabIndex={-1}>
      <section className={`${styles.section} ${styles.liveSection}`} aria-labelledby="live-title">
        {registered && <p className={styles.liveNotice} role="status"><Check size={18} aria-hidden="true" />Inscrição registrada. A transmissão está logo abaixo.</p>}
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>Codex Community · participe online</p>
          <h1 id="live-title">Assista ao workshop<br /><span>ao vivo.</span></h1>
          <p>Acompanhe a transmissão do Codex Community Workshop, da comunidade OpenAI, organizado pela Apogee. Se o vídeo não carregar aqui, abra a transmissão direto no YouTube.</p>
        </div>
        <div className={styles.livePlayer}>
          <iframe
            src={EVENT_LIVE_EMBED}
            title={liveTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <div className={styles.liveActions}>
          <a className={styles.primary} href={EVENT_LIVE_URL} target="_blank" rel="noopener noreferrer">
            <CirclePlay size={18} aria-hidden="true" />Assistir no YouTube<span className="sr-only"> (nova aba)</span>
          </a>
          <Link className={styles.secondary} href="/comunidade" prefetch={false}>Conhecer a Comunidade Apogee</Link>
        </div>
      </section>
    </main>
    <SiteFooter description="Conhecimento, oportunidades e gente para colocar ideias em movimento." />
  </div>;
}
