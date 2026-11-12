"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { motion, MotionConfig, useScroll, useSpring } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApogeeFlight } from "@/components/hero/ApogeeFlight";
import { EarthPosterFallback } from "@/components/hero/EarthPosterFallback";
import { useSiteLegalLinks } from "@/components/site/site-legal-links";
import { COMMUNITY_DELIVERABLES, COMMUNITY_FAQ, COMMUNITY_RADAR } from "@/content/community";
import hero from "@/components/hero/apogee.module.css";
// Deliberately reuse the Make It Fly layout instead of introducing a new design.
import styles from "@/components/landing/make-it-fly-v2.module.css";
import community from "./community-sales-page.module.css";

const SECTIONS = ["inicio", "experiencia", "entregaveis", "radar", "manifesto", "cursos", "newsletter", "participar", "duvidas"];
const LIGHT_SECTIONS = new Set(["radar", "cursos", "participar", "duvidas"]);

function Reveal({ children, className, delay = 0 }: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div data-v2-reveal className={className}
      initial={{ opacity: 0, y: 34 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.82, delay, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

export function CommunitySalesPage() {
  const legalLinks = useSiteLegalLinks();
  const pageRef = useRef<HTMLDivElement>(null);
  const [earthReady, setEarthReady] = useState(false);
  const [activeSection, setActiveSection] = useState("inicio");
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 92, damping: 24, mass: 0.22 });

  useEffect(() => {
    const nodes = SECTIONS.map(id => document.getElementById(id)).filter((node): node is HTMLElement => Boolean(node));
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-24% 0px -56%", threshold: [0, 0.15, 0.35, 0.6] });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={pageRef} className={styles.site} data-community-page>
        <motion.div aria-hidden className={styles.progress} style={{ scaleX: smoothProgress }} />
        <div aria-hidden className={styles.grain} />

        <header className={[styles.topbar, LIGHT_SECTIONS.has(activeSection) ? styles.topbarOnLight : ""].join(" ")}>
          <Link className={styles.brand} href="#inicio" aria-label="Comunidade Apogee — início">
            <span aria-hidden className={styles.brandMark} />
            <span className={styles.brandName}><span>Apogee</span><span>Comunidade</span></span>
          </Link>
          <nav className={styles.navLinks} aria-label="Navegação da comunidade">
            <Link href="/">Voltar à Apogee</Link>
            {[{ id: "entregaveis", label: "Entregáveis" }, { id: "cursos", label: "Cursos de IA" }, { id: "newsletter", label: "Newsletter" }].map(item => (
              <Link key={item.id} href={`#${item.id}`}
                className={activeSection === item.id ? styles.navActive : ""}
                aria-current={activeSection === item.id ? "location" : undefined}>{item.label}</Link>
            ))}
          </nav>
          <div className={styles.topbarActions}>
            <nav className={styles.mobilePortalLinks} aria-label="Áreas da Apogee"><Link href="/">Apogee</Link></nav>
            <Link className={styles.topbarCta} href="#participar">Conhecer a proposta <ArrowUpRight aria-hidden size={16} /></Link>
          </div>
        </header>

        <ApogeeFlight pageRef={pageRef} onReadyChange={setEarthReady} />

        <main>
          <section id="inicio" data-flight-section data-apogee-hero className={hero.hero} aria-labelledby="hero-title">
            <div className={hero.frame}>
              <EarthPosterFallback hidden={earthReady} />
              <div className={hero.scrim} aria-hidden />
              <div className={hero.content}>
                <div className={hero.topline}><span className={community.heroNote}>Oportunidades · Aprendizado · Curadoria</span></div>
                <div className={hero.statement}>
                  <p className={hero.eyebrow}>Comunidade Apogee</p>
                  <p className={hero.subtitle}>Conhecimento para construir. Oportunidades para avançar.</p>
                  <p className={hero.description}>Explore o Radar de oportunidades e conheça os cursos de IA e a newsletter curada que estamos preparando.</p>
                </div>
                <div className={hero.bottom}>
                  <h1 id="hero-title" className={community.heroWordmark}>Comunidade<span className={hero.srOnly}> Apogee</span></h1>
                  <div className={hero.footer}>
                    <ul aria-label="Entregáveis da comunidade"><li>Radar de oportunidades</li><li>Cursos de IA</li><li>Newsletter curada</li></ul>
                    <Link className={hero.cta} href="#entregaveis">Conhecer os entregáveis <ArrowUpRight aria-hidden size={17} /></Link>
                    <Link className={hero.scrollCue} href="#experiencia">Conheça a comunidade <span aria-hidden>↓</span></Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="experiencia" data-flight-section className={[styles.section, styles.darkSection, styles.experience].join(" ")} aria-labelledby="experience-title">
            <div className={styles.sectionInner}>
              <div className={styles.editorialSplit}>
                <Reveal className={styles.statColumn}>
                  <p className={styles.availabilityValue}>Apogee</p>
                  <p className={styles.statCaption}>Comunidade & aprendizado</p>
                  <p className={styles.eventCity}>Seu próximo passo.</p>
                  <p className={styles.statNote}>Ciência, tecnologia, inovação e gente com vontade de construir.</p>
                </Reveal>
                <Reveal className={styles.statementColumn} delay={0.08}>
                  <h2 id="experience-title">Curiosidade que vira movimento.</h2>
                  <p className={styles.sectionSubheading}>Encontre caminhos. Aprenda a fazer.</p>
                  <p className={styles.readingCopy}>A proposta da Comunidade Apogee reúne oportunidades, aprendizado em inteligência artificial e curadoria. Um lugar para descobrir possibilidades e transformar o que você aprende em próximos passos.</p>
                </Reveal>
              </div>
            </div>
          </section>

          <section id="entregaveis" data-flight-section className={[styles.section, styles.darkSection, styles.journey].join(" ")} aria-labelledby="deliverables-title">
            <div className={styles.sectionInner}>
              <Reveal className={styles.journeyHeading}>
                <h2 id="deliverables-title"><span>Três frentes.</span><span>Novos caminhos.</span></h2>
                <p>O Radar já está disponível. Cursos de IA e newsletter curada estão em preparação. Conheça cada parte da proposta e o estágio de cada entrega.</p>
              </Reveal>
              <div className={styles.steps}>
                {COMMUNITY_DELIVERABLES.map((item, index) => (
                  <Reveal key={item.title}>
                    <Link href={item.href} className={[styles.step, community.deliverable].join(" ")}>
                      <span className={styles.stepIndex}>{String(index + 1).padStart(2, "0")}</span>
                      <h3>{item.title}</h3>
                      <div className={community.deliverableCopy}>
                        <span className={[community.status, item.available ? community.available : ""].join(" ")}>{item.status}</span>
                        <p>{item.description}</p>
                      </div>
                      <span className={styles.stepArrow} aria-hidden><ArrowDownRight strokeWidth={1.5} /></span>
                    </Link>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section id="radar" data-flight-section className={[styles.section, styles.lightSection, styles.schedule].join(" ")} aria-labelledby="radar-title">
            <div className={styles.sectionInner}>
              <div className={styles.scheduleGrid}>
                <Reveal className={[styles.scheduleIntro, community.radarIntro].join(" ")}>
                  <p className={styles.scheduleKicker}>01 / Disponível</p>
                  <h2 id="radar-title">Radar de oportunidades.</h2>
                  <p className={styles.sectionSubheading}>Seu próximo caminho pode estar aqui.</p>
                  <p className={styles.readingCopy}>Reúna sua busca em um só lugar. Explore o Radar para encontrar oportunidades ligadas aos seus interesses e consultar as condições de cada uma.</p>
                  <Link className={styles.textLink} href="/oportunidades">Explorar o Radar <ArrowUpRight aria-hidden size={18} /></Link>
                </Reveal>
                <div className={styles.timeline}>
                  {COMMUNITY_RADAR.map((item, index) => (
                    <Reveal key={item.title} className={styles.timelineItem} delay={index * 0.06}><h3>{item.title}</h3><p>{item.description}</p></Reveal>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="manifesto" data-flight-section className={[styles.section, styles.darkSection, styles.manifesto].join(" ")} aria-labelledby="manifesto-title">
            <div className={styles.sectionInner}>
              <Reveal className={styles.manifestoCopy}>
                <h2 id="manifesto-title">O futuro também se aprende fazendo.</h2>
                <div className={styles.manifestoFoot}><p>Uma oportunidade abre uma porta. O aprendizado ajuda a atravessar. A Apogee conecta essas duas vontades: descobrir o que existe e construir o que ainda pode existir.</p><p>Comunidade Apogee.</p></div>
              </Reveal>
            </div>
          </section>

          <section id="cursos" data-flight-section className={[styles.section, styles.lightSection, styles.host].join(" ")} aria-labelledby="courses-title">
            <div className={styles.sectionInner}>
              <div className={styles.editorialSplit}>
                <Reveal className={styles.statColumn}>
                  <p className={[community.status, community.lightStatus].join(" ")}>02 / Em preparação</p>
                  <p className={[styles.availabilityValue, community.subjectWord].join(" ")}>Aprender.<br />Criar.<br />Aplicar.</p>
                </Reveal>
                <Reveal className={styles.statementColumn} delay={0.08}>
                  <h2 id="courses-title">Cursos de IA para colocar em prática.</h2>
                  <p className={styles.sectionSubheading}>Da ferramenta ao que você faz com ela.</p>
                  <p className={styles.readingCopy}>Estamos preparando os cursos de inteligência artificial da Apogee. A proposta é aprender com aplicações e projetos, aproximando o conteúdo daquilo que você quer construir.</p>
                  <p className={[styles.readingCopy, community.launchNote].join(" ")}>Os cursos ainda não estão disponíveis. Conteúdo, formato e abertura de acesso serão apresentados quando estiverem definidos.</p>
                </Reveal>
              </div>
            </div>
          </section>

          <section id="newsletter" data-flight-section className={[styles.section, styles.darkSection, styles.schedule].join(" ")} aria-labelledby="newsletter-title">
            <div className={styles.sectionInner}>
              <div className={styles.editorialSplit}>
                <Reveal className={styles.statColumn}>
                  <p className={community.status}>03 / Em preparação</p>
                  <p className={[styles.availabilityValue, community.subjectWord].join(" ")}>Uma boa<br />leitura abre<br />caminhos.</p>
                </Reveal>
                <Reveal className={styles.statementColumn} delay={0.08}>
                  <h2 id="newsletter-title">Newsletter com curadoria Apogee.</h2>
                  <p className={styles.sectionSubheading}>Referências que merecem sua atenção.</p>
                  <p className={styles.readingCopy}>Uma seleção de conteúdos e referências sobre ciência, tecnologia e inovação, com o olhar da Apogee para o que vale acompanhar.</p>
                  <p className={[styles.readingCopy, community.launchNote].join(" ")}>A newsletter ainda não foi lançada. A primeira edição e a frequência de envio estão em definição.</p>
                </Reveal>
              </div>
            </div>
          </section>

          <section id="participar" data-flight-section className={[styles.section, styles.ctaSection].join(" ")} aria-labelledby="participate-title">
            <div className={styles.sectionInner}>
              <Reveal className={styles.ctaCopy}>
                <h2 id="participate-title"><span className={styles.ctaAvailability}>Conheça o que já está no ar.</span><span>Acompanhe o que vem a seguir.</span></h2>
                <div className={[styles.ctaBottom, community.ctaActions].join(" ")}>
                  <Link className={styles.finalCta} href="/oportunidades">Explorar o Radar <ArrowUpRight aria-hidden size={20} /></Link>
                </div>
              </Reveal>
            </div>
          </section>

          <section id="duvidas" data-flight-section className={[styles.galleryPreview, community.faqSection].join(" ")} aria-labelledby="faq-title">
            <div className={styles.galleryPreviewInner}>
              <Reveal className={styles.galleryPreviewCopy}><p className={[styles.galleryPreviewLabel, community.faqLabel].join(" ")}>Antes de fazer parte</p><h2 id="faq-title">A comunidade, com clareza.</h2></Reveal>
              <div className={community.faqList}>
                {COMMUNITY_FAQ.map(item => (
                  <details key={item.question} className={community.faqItem}><summary>{item.question}<Plus aria-hidden size={20} /></summary><p>{item.answer}</p></details>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <Link className={community.footerBrand} href="/" aria-label="Apogee — página inicial"><Image src="/brand/apogee-logo-white.svg" alt="Apogee" width={1595} height={986} sizes="120px" /><span>Comunidade Apogee</span></Link>
          <div className={styles.footerMeta}><Link href="/makeitfly">Conhecer o Make It Fly <span aria-hidden>↗</span></Link><Link href="/">Voltar à Apogee <span aria-hidden>↗</span></Link></div>
          <div className={styles.footerMeta}><Link href="#inicio">Voltar ao topo <span aria-hidden>↑</span></Link>{legalLinks.privacy && <Link href="/privacidade">Privacidade</Link>}{legalLinks.terms && <Link href="/termos">Termos de uso</Link>}<a className={styles.footerCredit} href="/earth/CREDITS.md" target="_blank" rel="noreferrer">Créditos das imagens</a></div>
        </footer>
      </div>
    </MotionConfig>
  );
}
