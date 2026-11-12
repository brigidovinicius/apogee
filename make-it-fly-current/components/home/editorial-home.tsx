import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { BrandMark } from "@/components/ui/brand-mark";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { HomeRadar } from "./home-radar";
import styles from "./journal-home.module.css";

function EntryCard({ id, theme, format, title, href, action, picture, children }: {
  id: string; theme: string; format: string; title: string; href: string;
  action: string; picture: ReactNode; children: ReactNode;
}) {
  return <li className={styles.entry}>
    <article aria-labelledby={id}>
      <div className={styles.entryPicture}>{picture}</div>
      <div className={styles.entryBody}>
        <p className={styles.entryMeta}><span>{theme}</span><span>{format}</span></p>
        <h3 className={styles.entryTitle} id={id}>{title}</h3>
        <p className={styles.entrySummary}>{children}</p>
        <Link className={styles.entryAction} href={href} prefetch={false}>{action}<ArrowUpRight aria-hidden="true" size={18} /></Link>
        <div className={styles.entrySignature}><span>Apogee</span><BrandMark /></div>
      </div>
    </article>
  </li>;
}

export function EditorialHome() {
  return <div className={styles.page}>
    <SiteHeader current="home" prefetch={false} />
    <main id="experiencia" tabIndex={-1}>
      <section className={styles.intro} aria-labelledby="home-title">
        <h1 id="home-title">Um lugar para o seu próximo salto.</h1>
        <div className={styles.introActions}><p>Explore ciência e tecnologia, encontre oportunidades e participe de experiências para colocar suas ideias em prática.</p><div><Link className={styles.heroPrimary} href="/comunidade" prefetch={false}>Conhecer a comunidade<ArrowUpRight aria-hidden="true" size={18} /></Link><Link className={styles.heroSecondary} href="/oportunidades" prefetch={false}>Explorar oportunidades</Link></div></div>
      </section>

      <RedBullSupport showSponsorCaption={false} />

      <section className={styles.featureBand} aria-labelledby="home-explore-title">
        <div className={styles.featureLayout}>
          <aside className={styles.themeRail}>
            <h2 id="home-explore-title">Explore a Apogee</h2>
            <nav aria-label="Explore a Apogee">
              <Link href="/" aria-current="page" prefetch={false}>Em destaque</Link>
              <Link href="/oportunidades" prefetch={false}>Oportunidades</Link>
              <Link href="/blog" prefetch={false}>Ideias e leituras</Link>
              <Link href="/comunidade" prefetch={false}>Comunidade</Link>
              <Link href="/evento-openai" prefetch={false}>Evento gratuito</Link>
            </nav>
          </aside>
          <ul className={styles.entryGrid} tabIndex={0} aria-label="Destaques da Apogee">
            <EntryCard id="home-knowledge-title" theme="Conhecimento" format="Para explorar"
              title="Uma ideia pode levar você mais longe." href="/blog" action="Descobrir leituras"
              picture={<Image src="/media/earth-v2/earth-desktop-960.webp" alt="Terra vista do espaço, imagem da Apogee" width={960} height={540} sizes="(max-width: 760px) 86vw, (max-width: 1100px) 31vw, 27vw" preload />}>
              Ciência, tecnologia e novas perspectivas para aprender, questionar e construir.
            </EntryCard>
            <EntryCard id="home-radar-title" theme="Apogee Radar" format="Próximos passos"
              title="Encontre o que pode colocar você em movimento." href="/oportunidades" action="Explorar o Radar"
              picture={<div className={styles.radarArt} role="img" aria-label="Apogee Radar, novas possibilidades">
                <span className={styles.orbitOne} aria-hidden="true" /><span className={styles.orbitTwo} aria-hidden="true" /><span className={styles.orbitThree} aria-hidden="true" />
                <Image className={styles.radarLogo} src="/brand/apogee-logo-white.svg" alt="" width={1595} height={986} sizes="104px" />
              </div>}>
              Eventos, desafios, pesquisa e experiências. Explore por interesse e consulte as condições de cada oportunidade.
            </EntryCard>
            <EntryCard id="home-collection-title" theme="Builders Club" format="Identidade"
              title="Vista o que você cria." href="/loja" action="Conhecer a coleção"
              picture={<Image className={styles.collectionImage} src="/images/loja/moletom-frente.jpg" alt="Moletom da Apogee" width={1254} height={1254} sizes="(max-width: 760px) 86vw, (max-width: 1100px) 31vw, 27vw" />}>
              Peças que levam a estrela e a vontade de construir para o seu dia a dia.
            </EntryCard>
          </ul>
        </div>
      </section>

      <section className={styles.sectionWithRail} id="radar" aria-labelledby="home-opportunities-title">
        <div className={styles.sectionRail}>
          <h2 id="home-opportunities-title">Para colocar em prática</h2>
          <nav aria-label="Para colocar em prática">
            <Link href="/oportunidades" prefetch={false}>Ver o Radar</Link>
            <Link href="/blog" prefetch={false}>Encontrar um tema</Link>
          </nav>
        </div>
        <div className={styles.radarPreview}>
          <Suspense fallback={<p className={styles.catalogueMessage} role="status">Consultando as oportunidades do Radar…</p>}>
            <HomeRadar presentation="earth" classNames={styles} />
          </Suspense>
        </div>
      </section>

      <section className={styles.community} aria-labelledby="home-community-title">
        <div className={styles.communityCopy}>
          <p>Comunidade Apogee</p>
          <h2 id="home-community-title">Juntos, mais longe.</h2>
          <p>Encontros, projetos e outras perspectivas dão continuidade ao que começou como uma ideia.</p>
          <Link className={styles.inlineAction} href="/comunidade" prefetch={false}>Conhecer a comunidade<ArrowUpRight aria-hidden="true" size={18} /></Link>
        </div>
        <article className={styles.experience} aria-labelledby="home-experience-title">
          <Image className={styles.eventArt} src="/brand/apogee-star.svg" alt="" width={703} height={870} sizes="144px" />
          <div><p>Evento gratuito · organização Apogee</p><h3 id="home-experience-title">Codex Community</h3>
            <Link href="/evento-openai" prefetch={false}>Conhecer o evento gratuito<ArrowUpRight aria-hidden="true" size={18} /></Link>
          </div>
        </article>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
