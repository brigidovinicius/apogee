"use client";

import { ApogeeHero } from "@/components/hero/ApogeeHero";
import { ApogeeFlight } from "@/components/hero/ApogeeFlight";
import { EnergySupport } from "./EnergySupport";
import { ApplicationLink } from "@/components/application/ApplicationLink";
import { GalleryHomepagePreview } from "@/components/gallery/gallery-homepage-preview";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight } from "lucide-react";
import {
  motion,
  MotionConfig,
  useScroll,
  useSpring,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ABERTURA,
  AUTORA,
  EXPERIENCIA,
  JORNADA,
  MANIFESTO,
  PARTICIPAR,
  PROGRAMACAO,
  QUEM_CONDUZ,
} from "@/content/site";
import styles from "./make-it-fly-v2.module.css";

const SECTION_IDS = [
  "inicio",
  "experiencia",
  "jornada",
  "programacao",
  "manifesto",
  "quem-conduz",
  "participar",
  "galeria-preview",
] as const;

const LIGHT_SECTIONS = new Set(["programacao", "quem-conduz", "participar"]);

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      data-v2-reveal
      className={className}
      initial={{ opacity: 0, y: 34 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.82, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function MakeItFlyV2() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [earthReady, setEarthReady] = useState(false);
  const [activeSection, setActiveSection] = useState("inicio");
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 92,
    damping: 24,
    mass: 0.22,
  });

  useEffect(() => {
    const nodes = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => Boolean(node)
    );

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible) setActiveSection(visible.target.id);
      },
      {
        rootMargin: "-24% 0px -56%",
        threshold: [0, 0.15, 0.35, 0.6],
      }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const navigationOnLight = LIGHT_SECTIONS.has(activeSection);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={pageRef} className={styles.site}>
        <motion.div
          aria-hidden
          className={styles.progress}
          style={{ scaleX: smoothProgress }}
        />
        <div aria-hidden className={styles.grain} />

        <header
          className={[
            styles.topbar,
            navigationOnLight ? styles.topbarOnLight : "",
          ].join(" ")}
        >
          <a className={styles.brand} href="#inicio" aria-label="Make it fly — início">
            <span aria-hidden className={styles.brandMark} />
            <span className={styles.brandName}>
              <span>Make it fly</span>
              <span>By Apogee</span>
            </span>
          </a>

          <nav className={styles.navLinks} aria-label="Navegação principal">
            <a
              className={activeSection === "experiencia" ? styles.navActive : ""}
              href="#experiencia"
              aria-current={activeSection === "experiencia" ? "location" : undefined}
            >
              Experiência
            </a>
            <a
              className={activeSection === "programacao" ? styles.navActive : ""}
              href="#programacao"
              aria-current={activeSection === "programacao" ? "location" : undefined}
            >
              Programação
            </a>
            <Link
              className={activeSection === "galeria-preview" ? styles.navActive : ""}
              href="/galeria"
              aria-current={activeSection === "galeria-preview" ? "location" : undefined}
            >
              Galeria
            </Link>
            <Link href="/loja">Loja</Link>
          </nav>

          <div className={styles.topbarActions}>
            <nav className={styles.mobilePortalLinks} aria-label="Áreas do site">
              <Link href="/galeria">Galeria</Link>
              <Link href="/loja">Loja</Link>
            </nav>
            <ApplicationLink className={styles.topbarCta}>
              Participar
            </ApplicationLink>
          </div>
        </header>

        <ApogeeFlight pageRef={pageRef} onReadyChange={setEarthReady} />

        <main>
          <ApogeeHero earthReady={earthReady} />

          <section
            id="experiencia"
            data-flight-section
            className={[styles.section, styles.darkSection, styles.experience].join(
              " "
            )}
            aria-labelledby="experience-title"
          >
            <div className={styles.sectionInner}>
              <div className={styles.editorialSplit}>
                <Reveal className={styles.statColumn}>
                  <p className={styles.availabilityValue}>Vagas</p>
                  <p className={styles.statCaption}>limitadas</p>
                  <p className={styles.eventCity}>em Florianópolis</p>
                  <p className={styles.statNote}>
                    Tecnologia, ciência, inovação, criatividade e empreendedorismo.
                  </p>
                </Reveal>

                <Reveal className={styles.statementColumn} delay={0.08}>
                  <h2 id="experience-title">{EXPERIENCIA.titulo}</h2>
                  <p className={styles.sectionSubheading}>{EXPERIENCIA.subtitulo}</p>
                  <p className={styles.readingCopy}>{EXPERIENCIA.descricao}</p>
                </Reveal>
              </div>
            </div>
          </section>

          <EnergySupport />

          <section
            id="jornada"
            data-flight-section
            className={[styles.section, styles.darkSection, styles.journey].join(
              " "
            )}
            aria-labelledby="journey-title"
          >
            <div className={styles.sectionInner}>
              <Reveal className={styles.journeyHeading}>
                <h2 id="journey-title">
                  <span>{JORNADA.titulo}</span>
                  <span>{JORNADA.subtitulo}</span>
                </h2>
                <p>{JORNADA.descricao}</p>
              </Reveal>

              <div className={styles.steps}>
                {JORNADA.etapas.map((etapa, index) => (
                  <motion.article
                    data-v2-reveal
                    key={etapa.titulo}
                    className={styles.step}
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.35 }}
                    transition={{
                      duration: 0.72,
                      delay: index * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <span className={styles.stepIndex}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3>{etapa.titulo}</h3>
                    <p>{etapa.texto}</p>
                    <span className={styles.stepArrow} aria-hidden>
                      <ArrowDownRight strokeWidth={1.5} />
                    </span>
                  </motion.article>
                ))}
              </div>
            </div>
          </section>

          <section
            id="programacao"
            data-flight-section
            className={[styles.section, styles.lightSection, styles.schedule].join(
              " "
            )}
            aria-labelledby="schedule-title"
          >
            <div className={styles.sectionInner}>
              <div className={styles.scheduleGrid}>
                <Reveal className={styles.scheduleIntro}>
                  <h2 id="schedule-title">{PROGRAMACAO.titulo}</h2>
                  <p className={styles.sectionSubheading}>
                    {PROGRAMACAO.subtitulo}
                  </p>
                  <p className={styles.readingCopy}>{PROGRAMACAO.descricao}</p>
                </Reveal>

                <div className={styles.timeline}>
                  {PROGRAMACAO.momentos.map((momento, index) => (
                    <motion.article
                      data-v2-reveal
                      key={momento.titulo}
                      className={styles.timelineItem}
                      initial={{ opacity: 0, x: 26 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{
                        duration: 0.68,
                        delay: index * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <div>
                        <h3>{momento.titulo}</h3>
                        <p>{momento.texto}</p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            id="manifesto"
            data-flight-section
            className={[styles.section, styles.darkSection, styles.manifesto].join(
              " "
            )}
            aria-labelledby="manifesto-title"
          >
            <div className={styles.sectionInner}>
              <Reveal className={styles.manifestoCopy}>
                <h2 id="manifesto-title">{MANIFESTO.frase}</h2>
                <div className={styles.manifestoFoot}>
                  <p>{MANIFESTO.apoio}</p>
                  <p>{MANIFESTO.assinatura}</p>
                </div>
              </Reveal>
            </div>
          </section>

          <section
            id="quem-conduz"
            data-flight-section
            className={[styles.section, styles.lightSection, styles.host].join(" ")}
            aria-labelledby="host-title"
          >
            <div className={styles.sectionInner}>
              <div className={styles.hostGrid}>
                <Reveal className={styles.hostCopy} delay={0.1}>
                  <p className={styles.hostRole}>{QUEM_CONDUZ.subtitulo}</p>
                  <h2 id="host-title">{QUEM_CONDUZ.nome}</h2>
                  {QUEM_CONDUZ.paragrafos.map((paragrafo) => (
                    <p key={paragrafo}>{paragrafo}</p>
                  ))}
                  <a
                    className={styles.textLink}
                    href={AUTORA.instagram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {AUTORA.handle} <span aria-hidden>↗</span>
                  </a>
                </Reveal>
              </div>
            </div>
          </section>

          <section
            id="participar"
            data-flight-section
            className={[styles.section, styles.ctaSection].join(" ")}
            aria-labelledby="participate-title"
          >
            <div className={styles.sectionInner}>
              <Reveal className={styles.ctaCopy}>
                <h2 id="participate-title">
                  <span className={styles.ctaAvailability}>{PARTICIPAR.titulo}</span>
                  <span>{PARTICIPAR.subtitulo}</span>
                </h2>
                <div className={styles.ctaBottom}>
                  <p>{PARTICIPAR.descricao}</p>
                  <ApplicationLink className={styles.finalCta}>
                    {PARTICIPAR.botao.texto}
                  </ApplicationLink>
                </div>
              </Reveal>
            </div>
          </section>

          <section
            id="galeria-preview"
            data-flight-section
            className={styles.galleryPreview}
            aria-labelledby="gallery-preview-title"
          >
            <div className={styles.galleryPreviewInner}>
              <Reveal className={styles.galleryPreviewCopy}>
                <p className={styles.galleryPreviewLabel}>Comunidade Apogee · Make it Fly</p>
                <h2 id="gallery-preview-title">O evento também é visto por quem participa.</h2>
                <p>
                  Compartilhe seu olhar sobre o evento Make it Fly. Seus registros
                  integram a galeria da comunidade Apogee com créditos ou anonimamente.
                </p>
                <Link className={styles.galleryPreviewLink} href="/galeria#enviar-fotos">
                  Incluir fotos <ArrowDownRight aria-hidden strokeWidth={1.5} />
                </Link>
              </Reveal>

              <Reveal className={styles.galleryPreviewFrames} delay={0.08}>
                <GalleryHomepagePreview />
              </Reveal>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <div className={styles.footerSignature}>
            <Image
              className={styles.footerWordmark}
              src="/brand/make-it-fly-wordmark.png"
              alt="Make it fly — Building the future"
              width={2097}
              height={523}
              sizes="220px"
            />
            <div className={styles.footerEndorsement}>
              <span>By</span>
              <Image
                src="/brand/apogee-logo-white.svg"
                alt="Apogee"
                width={1595}
                height={986}
                sizes="74px"
              />
            </div>
          </div>
          <div className={styles.footerSupport}>
            <span>{ABERTURA.apoio.rotulo}</span>
            <Image
              src={ABERTURA.apoio.logo}
              alt={ABERTURA.apoio.logoAlt}
              width={1726}
              height={4918}
              sizes="32px"
            />
          </div>
          <div className={styles.footerMeta}>
            <a href="#inicio">
              Voltar ao topo <span aria-hidden>↑</span>
            </a>
            <a className={styles.footerCredit} href="/earth/CREDITS.md" target="_blank" rel="noreferrer">
              Créditos das imagens
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

export default MakeItFlyV2;
