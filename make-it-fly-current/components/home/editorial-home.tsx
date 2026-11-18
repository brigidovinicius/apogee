import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { HomeRadar } from "./home-radar";
import { HomeStar } from "./home-star";
import styles from "./journal-home.module.css";

function EntryCard({ id, theme, title, href, action, picture, children }: {
  id: string; theme: string; title: string; href: string;
  action: string; picture: ReactNode; children: ReactNode;
}) {
  return <li className={styles.entry}>
    <article aria-labelledby={id}>
      <div className={styles.entryPicture}>{picture}</div>
      <div className={styles.entryBody}>
        <p className={styles.entryMeta}>{theme}</p>
        <h3 className={styles.entryTitle} id={id}>{title}</h3>
        <p className={styles.entrySummary}>{children}</p>
        <Link className={styles.entryAction} href={href} prefetch={false}>{action}<ArrowUpRight aria-hidden="true" size={18} /></Link>
      </div>
    </article>
  </li>;
}

export function EditorialHome() {
  return <div className={styles.page}>
    <SiteHeader current="home" prefetch={false} adaptive tone="light" />
    <main id="experiencia" tabIndex={-1}>
      <section className={styles.intro} aria-labelledby="home-title">
        <div className={styles.introHeading}>
          <h1 id="home-title">Um lugar para o seu próximo salto.</h1>
          <p className={styles.introLead}>Encontre oportunidades e aprenda a aplicar IA com a comunidade Apogee.</p>
          <div className={styles.introActions}>
            <Link className={styles.heroPrimary} href="/comunidade" prefetch={false}>Conhecer a comunidade<ArrowUpRight aria-hidden="true" size={16} /></Link>
            <Link className={styles.heroSecondary} href="/oportunidades" prefetch={false}>Explorar o Radar</Link>
          </div>
        </div>
        <HomeStar />
        <div className={styles.communityWord} lang="en" aria-hidden="true">Building<br />the future.</div>
      </section>

      <div className={styles.supportStrip}><RedBullSupport /></div>

      <section className={styles.radarSection} id="radar" aria-labelledby="home-opportunities-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="home-opportunities-title">Um mundo de oportunidades.</h2><p>Encontre seu próximo desafio no Radar.</p></div>
          <Link className={styles.inlineAction} href="/oportunidades" prefetch={false}>Explorar o Radar<ArrowUpRight aria-hidden="true" size={18} /></Link>
        </div>
        <Suspense fallback={<p className={styles.catalogueMessage} role="status">Consultando as oportunidades do Radar…</p>}>
          <HomeRadar presentation="carousel" classNames={styles} />
        </Suspense>
      </section>

      <section className={styles.featureBand} aria-labelledby="home-explore-title">
        <div className={styles.featureLayout}>
          <div className={styles.sectionHeading}><h2 id="home-explore-title">Continue explorando.</h2></div>
          <ul className={styles.entryGrid} aria-label="Destaques da Apogee">
            <EntryCard id="home-knowledge-title" theme="Conhecimento"
              title="Uma ideia pode levar você mais longe." href="/blog" action="Descobrir leituras"
              picture={<Image src="/media/earth-v2/earth-desktop-960.webp" alt="Terra vista do espaço, imagem da Apogee" width={960} height={540} sizes="(max-width: 760px) 100vw, 50vw" />}>
              Ciência, tecnologia e novas perspectivas.
            </EntryCard>
            <EntryCard id="home-collection-title" theme="Builders Club"
              title="Vista o que você cria." href="/loja" action="Conhecer a coleção"
              picture={<Image className={styles.collectionImage} src="/images/loja/moletom-frente.jpg" alt="Moletom da Apogee" width={1254} height={1254} sizes="(max-width: 760px) 100vw, 50vw" />}>
              A estrela da Apogee no seu dia a dia.
            </EntryCard>
          </ul>
        </div>
      </section>

      <section className={styles.community} aria-labelledby="home-community-title">
        <div className={styles.communityCopy}>
          <p>Comunidade Apogee</p>
          <h2 id="home-community-title">Juntos, mais longe.</h2>
          <p>Aprenda, encontre novas possibilidades e construa com a comunidade. Comece gratuitamente.</p>
          <Link className={styles.inlineAction} href="/comunidade" prefetch={false}>Conhecer a Comunidade Apogee<ArrowUpRight aria-hidden="true" size={18} /></Link>
        </div>
        <article className={styles.experience} aria-labelledby="home-experience-title">
          <Image className={styles.eventArt} src="/brand/apogee-star.svg" alt="" width={703} height={870} sizes="100px" />
          <div><p>Evento gratuito · organização Apogee</p><h3 id="home-experience-title">Codex Community</h3>
            <p>Um encontro para colocar a inteligência artificial em prática.</p>
            <Link href="/evento-openai" prefetch={false}>Conhecer o evento gratuito<ArrowUpRight aria-hidden="true" size={18} /></Link>
          </div>
        </article>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
