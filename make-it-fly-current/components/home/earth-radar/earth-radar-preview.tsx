"use client";

import Link from "next/link";
import { SiteFooter } from "@/components/site/site-footer";
import { useMotionValue } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import styles from "./earth-radar.module.css";
import { EarthRadarScene } from "./earth-radar-scene";
import { EarthSignature } from "./earth-signature";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
// A curva começa e termina sem mudanças bruscas de velocidade.
const smoothProgress = (value: number) => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};

export function EarthRadarPreview({ radar }: { radar: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const earthProgress = useMotionValue(0);
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const pageStyle = container.style;
    const stage = container.querySelector<HTMLElement>("[data-earth-stage]")!;
    const message = container.querySelector<HTMLElement>("[data-earth-message]")!;
    const signature = container.querySelector<HTMLElement>("[data-earth-signature]")!;
    const nav = container.querySelector<HTMLElement>("[data-preview-nav]")!;
    const progressLine = container.querySelector<HTMLElement>("[data-page-progress]")!;
    const lightSections = container.querySelectorAll<HTMLElement>('[data-nav-theme="light"]');
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;

    // Um cálculo por quadro, mesmo quando chegam vários eventos de rolagem.
    function update() {
      animationFrame = 0;
      const stageTop = stage.getBoundingClientRect().top + window.scrollY;
      const progress = clamp((window.scrollY - stageTop) / Math.max(stage.offsetHeight - window.innerHeight, 1));
      const morph = smoothProgress((progress - 0.12) / 0.76);
      earthProgress.set(reduced.matches ? 0 : morph);
      signature.style.opacity = String(reduced.matches ? 1 : 1 - smoothProgress((progress - 0.16) / 0.24));
      const messageProgress = reduced.matches ? 1 : smoothProgress((progress - 0.42) / 0.42);
      pageStyle.setProperty("--earth-copy-progress", String(messageProgress));
      message.style.opacity = String(messageProgress);
      message.style.transform = reduced.matches ? "" : `translate(-50%, ${20 * (1 - messageProgress)}px)`;
      message.dataset.visible = String(messageProgress > 0);
      message.inert = messageProgress < 0.9;
      const navProgress = reduced.matches ? (window.scrollY > 24 ? 1 : 0) : clamp((progress - 0.28) / 0.16);
      nav.style.opacity = String(navProgress);
      nav.style.transform = `translateY(${-12 * (1 - navProgress)}px)`;
      nav.classList.toggle(styles["is-visible"], navProgress > 0.9);
      nav.inert = navProgress < 0.9;
      nav.classList.toggle(styles["is-light"], [...lightSections].some((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= 76 && rect.bottom > 76;
      }));
      progressLine.style.width = `${clamp(window.scrollY / Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)) * 100}%`;
    }
    function schedule() {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update);
    }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    update();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [earthProgress]);

  return <div ref={root} className={styles.preview}>
    <div className={styles["page-progress"]} data-page-progress aria-hidden="true" />
    <header className={styles["global-nav"]} data-preview-nav inert>
      <div className={styles["nav-inner"]}>
        <a className={styles.wordmark} href="#experiencia" aria-label="Apogee, voltar ao início">Apogee</a>
        <nav className={styles["nav-links"]} aria-label="Navegação principal">
          <a href="#radar">Radar</a><a href="#comunidade">Comunidade</a>
          <Link prefetch={false} href="/blog">Blog</Link><Link prefetch={false} href="/makeitfly">Make It Fly</Link>
          <Link prefetch={false} className={styles["nav-access"]} href="/membros/entrar">Acessar</Link>
        </nav>
      </div>
    </header>
    <main id="experiencia" tabIndex={-1}>
      <section className={styles["earth-stage"]} data-earth-stage aria-label="Abertura da Apogee">
        <div className={styles["earth-sticky"]}>
          <EarthRadarScene progress={earthProgress} />
          <EarthSignature />
          <div className={styles["earth-message"]} data-earth-message data-visible="false" inert>
            <h1>Seu próximo salto.</h1>
            <p>Oportunidades, encontros e gente curiosa para construir o que vem a seguir.</p>
            <a href="#radar">Explorar o Radar</a>
          </div>
        </div>
      </section>
      <noscript><p>Explore o Radar e a comunidade Apogee abaixo. Ative o JavaScript para acompanhar a animação e usar os filtros.</p></noscript>
      <section className={styles.radar} id="radar" data-nav-theme="light" aria-labelledby="preview-radar-title">
        <header className={styles["radar-heading"]}>
          <div className={styles["radar-heading-top"]}><span>Radar de oportunidades</span><span>Explore novas possibilidades</span></div>
          <h2 id="preview-radar-title">O mundo não espera.</h2>
          <p>Hackathons, competições, eventos e outras possibilidades para colocar suas ideias em movimento.</p>
        </header>
        {radar}
      </section>
      <section className={styles["habit-section"]} aria-labelledby="preview-habit-title">
        <div className={styles["habit-grid"]}>
          <div className={styles["habit-copy"]}><h2 id="preview-habit-title">Um Radar que muda com você.</h2><p>A experiência não termina na primeira busca. Ela organiza o que é novo, o que está perto do prazo e o que você decidiu acompanhar.</p></div>
          <div className={styles["habit-cards"]}>
            <article className={styles["habit-card"]}><small>Quando você volta</small><h3>Encontre seu próximo passo.</h3><p>Explore o catálogo atualizado e descubra possibilidades para seu próximo passo.</p><div className={styles["habit-example"]}><span>Oportunidades em destaque</span><Link prefetch={false} href="/oportunidades">Explorar</Link></div></article>
            <article className={styles["habit-card"]}><small>Antes que o prazo passe</small><h3>Saiba o que exige atenção agora.</h3><p>Prazos próximos ficam claros sem transformar o site numa sequência de alertas agressivos.</p><div className={styles["habit-example"]}><span>Encontre os próximos prazos</span><Link prefetch={false} href="/oportunidades?prazo=7dias">Consultar</Link></div></article>
            <article className={styles["habit-card"]}><small>Para continuar depois</small><h3>Guarde possibilidades, não abas.</h3><p>O que você salva forma um espaço pessoal de pesquisa e ajuda a organizar seu próximo passo.</p><div className={styles["habit-example"]}><span>Continue no seu espaço pessoal</span><Link prefetch={false} href="/membros/oportunidades">Acessar</Link></div></article>
          </div>
        </div>
      </section>
      <section className={styles.community} id="comunidade" data-nav-theme="light" aria-labelledby="preview-community-title">
        <div className={styles["community-inner"]}>
          <div className={styles["community-copy"]}><h2 id="preview-community-title">Juntos, mais longe.</h2><p>Uma ideia pode começar com você. Na Apogee, ela encontra outras perspectivas, conversas e espaço para sair do papel.</p></div>
          <nav className={styles["community-links"]} aria-label="Explorar a comunidade">
            <Link prefetch={false} href="/galeria"><span>Os encontros em imagens</span><span>Galeria</span></Link>
            <Link prefetch={false} href="/blog"><span>Ideias para continuar a conversa</span><span>Blog</span></Link>
            <Link prefetch={false} href="/makeitfly"><span>Da ideia ao encontro</span><span>Make It Fly</span></Link>
          </nav>
        </div>
      </section>
      <section className={styles.membership} id="acesso" aria-labelledby="preview-access-title">
        <div className={styles["membership-inner"]}><div><h2 id="preview-access-title">O Radar completo, para sempre.</h2><p>Explore uma oportunidade gratuitamente. Depois, tenha acesso vitalício ao Radar por R$ 49.</p></div><Link prefetch={false} className={styles["membership-cta"]} href="/membros/radar/acesso">Conhecer o acesso vitalício</Link></div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
