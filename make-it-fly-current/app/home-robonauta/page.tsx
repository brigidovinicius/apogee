import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight } from "lucide-react";
import { Robonauta } from "@/components/home/robonauta";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Apogee — Home com Robonauta",
  description: "Comunidade e experiências para quem quer tirar uma ideia do papel.",
  robots: { index: false, follow: false },
};

export default function RobonautaHomePage() {
  return (
    <div className={styles.page}>
      <SiteHeader current="home" tone="light" />
      <main id="experiencia" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroInner}>
            <div className={styles.intro}>
              <p className={styles.eyebrow}>Comunidade & experiências</p>
              <h1 id="home-title">
                Ideias que<br />chegam<br /><em>mais alto.</em>
              </h1>
              <p className={styles.lead}>
                Gente curiosa. Encontros que movem.<br />
                Um lugar para tirar sua ideia do papel.
              </p>
              <div className={styles.actions}>
                <Link href="/makeitfly" className={styles.primaryLink}>
                  Conheça o Make It Fly <ArrowUpRight size={19} aria-hidden="true" />
                </Link>
                <Link href="/galeria" className={styles.textLink}>
                  Explore a galeria <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className={styles.mascot}>
              <Robonauta />
            </div>
          </div>
          <div className={styles.heroBottom}>
            <a href="#encontros" className={styles.exploreLink}>
              Tem mais por aqui <ArrowDown size={15} aria-hidden="true" />
            </a>
            <p>Apogee. O ponto de encontro das suas próximas ideias.</p>
          </div>
        </section>

        <section id="encontros" className={styles.event} aria-labelledby="event-title">
          <div className={styles.eventInner}>
            <div className={styles.eventBrand}>
              <p className={styles.eyebrow}>Da ideia ao encontro</p>
              <Image
                src="/brand/make-it-fly-wordmark.png"
                alt="Make It Fly — Building the future"
                width={2097}
                height={523}
                sizes="(max-width: 700px) 85vw, 430px"
              />
            </div>
            <div className={styles.eventCopy}>
              <h2 id="event-title">Um dia para<br /><em>avançar sua ideia.</em></h2>
              <p>Um encontro de coworking, comunidade e foco para quem quer dar o próximo passo. Traga sua ideia. Encontre novas perspectivas.</p>
              <Link href="/makeitfly" className={styles.eventLink}>
                Conheça o encontro <ArrowUpRight size={20} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.discover} aria-labelledby="discover-title">
          <div className={styles.discoverHeading}>
            <p className={styles.eyebrow}>Continue explorando</p>
            <h2 id="discover-title">A comunidade<br /><em>acontece aqui.</em></h2>
          </div>
          <div className={styles.destinations}>
            <Link href="/galeria" className={styles.destination}>
              <span className={styles.destinationLabel}>Galeria</span>
              <span className={styles.destinationTitle}>Encontros que ficam.<small>Veja os registros da comunidade.</small></span>
              <ArrowUpRight size={27} aria-hidden="true" />
            </Link>
            <Link href="/oportunidades" className={styles.destination}>
              <span className={styles.destinationLabel}>Oportunidades</span>
              <span className={styles.destinationTitle}>Olhe para o próximo passo.<small>Explore a prévia do Radar Apogee.</small></span>
              <ArrowUpRight size={27} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
