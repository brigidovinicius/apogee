import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import ArrowFillButton from "@/components/ui/arrow-fill-button";
import { HomeMotion } from "./home-motion";
import { HomeRadar } from "./home-radar";
import styles from "./editorial-home.module.css";

export function EditorialHome() {
  return <HomeMotion>
    <SiteHeader current="home" prefetch={false} />
    <main id="experiencia" tabIndex={-1}>
      <section className={styles.hero} aria-labelledby="home-title">
        <p className={styles.heroEyebrow}>Comunidade Apogee · Ideias em movimento</p>
        <h1 id="home-title"><span className={styles.titleLine}><span data-home-reveal>Seu próximo</span></span><span className={styles.titleLine}><span data-home-reveal data-home-delay="0.11">salto.</span></span></h1>
        <div className={styles.heroBottom}>
          <p data-home-reveal data-home-delay="0.18">Oportunidades, encontros e gente curiosa para construir o que vem a seguir.</p>
          <div className={styles.heroActions} data-home-reveal data-home-delay="0.25">
            <ArrowFillButton href="https://buy.stripe.com/aFa6oG2K91Y70WI0MLbQY01" btnText="Acesso vitalício ao Radar por R$ 49,00" />
            <ArrowFillButton href="/oportunidades" btnText="Explorar o Radar" className={styles.secondaryAction} bgColor="var(--apogee-navy)" textColor="var(--apogee-white)" fillTextColor="var(--apogee-navy)" hoverFillTextColor="var(--apogee-navy)" />
            <Link href="#comunidade" className={styles.communityAction}>Conheça a comunidade <span aria-hidden="true">↓</span></Link>
          </div>
        </div>
      </section>

      <section className={styles.radar} id="radar" aria-labelledby="radar-title">
        <div className={styles.sectionHeading}>
          <h2 id="radar-title" data-home-reveal>O mundo não<br />espera.</h2>
          <div data-home-reveal data-home-delay="0.08"><p>Hackathons, competições, eventos e outras possibilidades para colocar suas ideias em movimento.</p><Link prefetch={false} href="/oportunidades" className={styles.inlineLink}>Ver o Radar completo <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link></div>
        </div>
        <Suspense fallback={<p className={styles.catalogueMessage} role="status">Consultando as oportunidades do Radar…</p>}><HomeRadar /></Suspense>
      </section>

      <section id="comunidade" className={styles.community} aria-labelledby="community-title">
        <div className={styles.communityIntro}>
          <h2 id="community-title" data-home-reveal>Juntos,<br />mais longe.</h2>
          <div data-home-reveal data-home-delay="0.08"><p>Uma ideia pode começar com você. Na Apogee, ela encontra outras perspectivas, conversas e espaço para sair do papel.</p><Link prefetch={false} className={styles.inlineLink} href="/membros/cadastro">Encontrar a comunidade <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link></div>
        </div>
        <nav className={styles.communityLinks} aria-label="Explore a comunidade">
          <Link prefetch={false} href="/galeria">Os encontros em imagens <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link>
          <Link prefetch={false} href="/blog">Ideias para continuar a conversa <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link>
        </nav>
      </section>

      <section id="encontros" className={styles.event} aria-labelledby="event-title">
        <div className={styles.eventBrand} data-home-reveal><Image src="/brand/make-it-fly-wordmark.png" alt="Make It Fly - Building the future" width={2097} height={523} sizes="(max-width: 700px) 90vw, 50vw" /><p>Um encontro da Apogee Builders Club.</p></div>
        <div className={styles.eventCopy}>
          <h2 id="event-title" data-home-reveal>Da ideia<br />ao encontro.</h2>
          <p data-home-reveal data-home-delay="0.08">Coworking, comunidade e foco para dar o próximo passo. Traga sua ideia. Encontre novas perspectivas.</p>
          <Link prefetch={false} className={styles.inlineLink} href="/makeitfly" data-home-reveal data-home-delay="0.16">Conheça o Make It Fly <span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></Link>
        </div>
      </section>

      <a className={styles.join} href="/membros/cadastro" aria-label="Criar sua conta na comunidade Apogee">
        <span className={styles.joinIntro}>Seu próximo passo começa com uma conversa.<span aria-hidden="true"><ArrowUpRight aria-hidden="true" size="1em" style={{ display: "inline-block", verticalAlign: "middle" }} /></span></span>
        <span className={styles.joinWord} data-home-reveal>Participe.</span>
      </a>
    </main>
    <SiteFooter />
  </HomeMotion>;
}
