import { Suspense, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Compass, Gift, Wrench } from "lucide-react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { RedBullSupport } from "@/components/site/red-bull-support";
import { HomeRadar } from "./home-radar";
import { COMMUNITY_SIGNUP_PATH } from "@/content/community-offer";
import { COMMUNITY_SALES_DELIVERABLES } from "@/components/community/community-deliverables";
import { HomeStar } from "./home-star";
import styles from "./journal-home.module.css";

const resourceIcons = { ferramentas: Wrench, learn: BookOpen, radar: Compass, perks: Gift };

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
          <h1 id="home-title">Uma comunidade para criar com IA.</h1>
          <p className={styles.introLead}>Na Apogee, você troca ideias com outros membros, encontra ferramentas e aprende a usar IA em um projeto seu.</p>
          <div className={styles.introActions}>
            <Link className={styles.heroPrimary} href="/comunidade" prefetch={false}>Conhecer a comunidade<ArrowUpRight aria-hidden="true" size={16} /></Link>
            <Link className={styles.heroSecondary} href="#recursos">Ver ferramentas e recursos</Link>
          </div>
        </div>
        <HomeStar />
        <div className={styles.communityWord} lang="en" aria-hidden="true">Building<br />the future.</div>
      </section>

      <section className={styles.resourceBand} id="recursos" aria-labelledby="home-resources-title">
        <div className={styles.featureLayout}>
          <div className={styles.sectionHeading}><h2 id="home-resources-title">Ferramentas da comunidade</h2></div>
          <ul className={styles.resourceGrid}>
            {COMMUNITY_SALES_DELIVERABLES.map(resource => {
              const Icon = resourceIcons[resource.id];
              return <li key={resource.id}>
                <Link className={styles.resourceLink} href={`/comunidade${resource.href}`} prefetch={false}>
                  <Icon aria-hidden="true" size={23} strokeWidth={1.5} />
                  <h3>{resource.label}</h3>
                  <p>{resource.title}</p>
                  <span>{resource.fact}<ArrowUpRight aria-hidden="true" size={16} /></span>
                </Link>
              </li>;
            })}
          </ul>
        </div>
      </section>

      <div className={styles.supportStrip}><RedBullSupport /></div>

      <section className={styles.radarSection} id="radar" aria-labelledby="home-opportunities-title">
        <div className={styles.sectionHeading}>
          <div><h2 id="home-opportunities-title">Oportunidades em destaque</h2><p>Confira os prazos de inscrição e as datas dos eventos.</p></div>
          <Link className={styles.inlineAction} href="/oportunidades" prefetch={false}>Explorar o Radar<ArrowUpRight aria-hidden="true" size={18} /></Link>
        </div>
        <Suspense fallback={<p className={styles.catalogueMessage} role="status">Consultando as oportunidades do Radar…</p>}>
          <HomeRadar presentation="carousel" classNames={styles} />
        </Suspense>
      </section>

      <section className={styles.featureBand} aria-labelledby="home-explore-title">
        <div className={styles.featureLayout}>
          <div className={styles.sectionHeading}><h2 id="home-explore-title">Blog e coleção Apogee</h2></div>
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
          <h2 id="home-community-title">Comece com uma conta gratuita.</h2>
          <p>Conheça a área de membros e consulte os detalhes de até 10 eventos no Radar. O cadastro é gratuito e dispensa cartão.</p>
          <Link className={styles.inlineAction} href={COMMUNITY_SIGNUP_PATH} prefetch={false}>Criar minha conta gratuita<ArrowUpRight aria-hidden="true" size={18} /></Link>
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
