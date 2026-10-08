import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "./home.module.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Home provisória da Apogee até o site oficial existir. O Make It Fly vive em /makeitfly.
export default function ApogeeHome() {
    return (
      <div className={styles.page}>
      <SiteHeader current="home" />

      <main id="experiencia" className={styles.main} tabIndex={-1}>
        <section className={styles.intro} aria-labelledby="home-title">
          <h1 id="home-title" className={styles.title}>Ideias que chegam ao ponto mais alto.</h1>
          <p className={styles.lead}>Comunidade e experiências para quem quer tirar uma ideia do papel. O site completo está a caminho.</p>
          <div className={styles.actions}>
            <Link href="/makeitfly" className={styles.primaryAction}>Conhecer o Make It Fly</Link>
            <Link href="/galeria" className={styles.secondaryAction}>Ver a galeria</Link>
          </div>
        </section>

        <section className={styles.event} aria-labelledby="event-title">
          <Image className={styles.wordmark} src="/brand/make-it-fly-wordmark.png" alt="Make It Fly — Building the future" width={2097} height={523} sizes="(max-width: 720px) 16rem, 22rem" />
          <div className={styles.eventContent}>
            <h2 id="event-title">Um dia para avançar sua ideia.</h2>
            <p>Um encontro de coworking, comunidade e foco para quem quer dar o próximo passo.</p>
          </div>
          <Link href="/makeitfly" className={styles.eventLink}>Ver detalhes do evento <span aria-hidden="true">›</span></Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
