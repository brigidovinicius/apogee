"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  motion,
  MotionConfig,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import {
  ABERTURA,
  AUTORA,
  EXPERIENCIA,
  JORNADA,
  MANIFESTO,
  PARTICIPAR,
  PROGRAMACAO,
  QUEM_CONDUZ,
} from "@/content/published-site";
import styles from "./make-it-fly-v2.module.css";

const MoonScene = dynamic(
  () => import("@/components/ui/moon-scene").then((module) => module.MoonScene),
  { ssr: false, loading: () => null }
);

const SECTION_IDS = [
  "inicio",
  "experiencia",
  "jornada",
  "programacao",
  "manifesto",
  "quem-conduz",
  "participar",
] as const;

const LIGHT_SECTIONS = new Set(["programacao", "quem-conduz", "participar"]);
const SCROLL_STOPS = [0, 0.13, 0.28, 0.45, 0.61, 0.77, 0.91, 1];
const DESKTOP_MOON_X = [
  "73vw",
  "83vw",
  "17vw",
  "50vw",
  "50vw",
  "18vw",
  "79vw",
  "50vw",
];
const DESKTOP_MOON_Y = [
  "43vh",
  "56vh",
  "32vh",
  "32vh",
  "48vh",
  "38vh",
  "56vh",
  "82vh",
];
const MOBILE_MOON_X = [
  "76vw",
  "74vw",
  "82vw",
  "66vw",
  "50vw",
  "76vw",
  "72vw",
  "50vw",
];
const MOBILE_MOON_Y = [
  "36vh",
  "30vh",
  "18vh",
  "67vh",
  "50vh",
  "22vh",
  "24vh",
  "84vh",
];
const MOON_SCALE = [1.04, 0.8, 0.68, 0.94, 1.28, 0.72, 0.82, 0.58];
const DESKTOP_MOON_OPACITY = [0.74, 0.52, 0.72, 0.1, 0.32, 0.42, 0.28, 0];
const MOBILE_MOON_OPACITY = [0.5, 0.34, 0.26, 0.1, 0.18, 0.2, 0.14, 0];
const MOON_ROTATION = [-7, 8, -14, 17, -9, 12, -5, 18];

function SectionLabel({
  current,
  children,
}: {
  current: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.sectionLabel}>
      <span>{current} / 06</span>
      <span className={styles.sectionLabelRule} />
      <span>{children}</span>
    </div>
  );
}

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
  const [activeSection, setActiveSection] = useState("inicio");
  const [compact, setCompact] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [asteroidsRevealed, setAsteroidsRevealed] = useState(false);
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 92,
    damping: 24,
    mass: 0.22,
  });

  const moonX = useTransform(
    smoothProgress,
    SCROLL_STOPS,
    compact ? MOBILE_MOON_X : DESKTOP_MOON_X
  );
  const moonY = useTransform(
    smoothProgress,
    SCROLL_STOPS,
    compact ? MOBILE_MOON_Y : DESKTOP_MOON_Y
  );
  const moonScale = useTransform(smoothProgress, SCROLL_STOPS, MOON_SCALE);
  const moonOpacity = useTransform(
    smoothProgress,
    SCROLL_STOPS,
    compact ? MOBILE_MOON_OPACITY : DESKTOP_MOON_OPACITY
  );
  const moonRotation = useTransform(
    smoothProgress,
    SCROLL_STOPS,
    MOON_ROTATION
  );
  const brandStarRotation = useTransform(smoothProgress, [0, 1], [-18, 252]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const nodes = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (node): node is HTMLElement => Boolean(node)
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target.id === "jornada" && entry.isIntersecting) {
            setAsteroidsRevealed(true);
          }
        }

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
      <div className={styles.site}>
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
            <a
              className={activeSection === "quem-conduz" ? styles.navActive : ""}
              href="#quem-conduz"
              aria-current={activeSection === "quem-conduz" ? "location" : undefined}
            >
              Rosa
            </a>
          </nav>

          <a className={styles.topbarCta} href="#participar">
            Participar <span aria-hidden>↗</span>
          </a>
        </header>

        <motion.div
          aria-hidden
          className={styles.moonPosition}
          data-moon-position
          data-motion-mode={reduceMotion ? "reduced" : "full"}
          style={{
            x: moonX,
            y: moonY,
            scale: moonScale,
            rotate: moonRotation,
            opacity: moonOpacity,
          }}
        >
          <div className={styles.moonStage}>
            <MoonScene
              reducedMotion={reduceMotion}
              showAsteroids={asteroidsRevealed}
              compact={compact}
            />
          </div>
          <motion.span
            className={styles.moonBrandStar}
            style={{ rotate: brandStarRotation }}
          />
        </motion.div>

        <main>
          <section
            id="inicio"
            data-flight-section
            className={[styles.section, styles.hero].join(" ")}
            aria-labelledby="hero-title"
          >
            <div className={styles.heroAtmosphere} />
            <div className={styles.heroTopline}>
              <p>{ABERTURA.localData}</p>
              <div className={styles.supportLockup}>
                <span>{ABERTURA.apoio.rotulo}</span>
                <Image
                  src={ABERTURA.apoio.logo}
                  alt={ABERTURA.apoio.logoAlt}
                  width={520}
                  height={339}
                  priority
                  sizes="96px"
                />
              </div>
            </div>

            <motion.div
              data-v2-reveal
              className={styles.heroStatement}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <span aria-hidden className={styles.orbitGlyph} />
              <p className={styles.heroEyebrow}>{ABERTURA.iniciativa}</p>
              <p className={styles.heroSubtitle}>{ABERTURA.subtitulo}</p>
              <p className={styles.heroDescription}>{ABERTURA.descricao}</p>
            </motion.div>

            <div className={styles.heroBottom}>
              <h1 id="hero-title" className={styles.heroTitle}>
                <span className={styles.visuallyHidden}>
                  {ABERTURA.titulo} {ABERTURA.destaque}
                </span>
                <span className={styles.titleClip} aria-hidden>
                  <motion.span
                    data-v2-reveal
                    className={styles.heroWordmarkFrame}
                    initial={{ y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 1.05,
                      delay: 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Image
                      className={styles.heroWordmark}
                      src="/brand/make-it-fly-wordmark.png"
                      alt=""
                      width={2097}
                      height={523}
                      loading="eager"
                      fetchPriority="high"
                      sizes="96vw"
                    />
                  </motion.span>
                </span>
              </h1>

              <div className={styles.heroFooter}>
                <ul aria-label="Informações do evento">
                  {ABERTURA.meta.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <a className={styles.heroCta} href="#participar">
                  {ABERTURA.cta} <span aria-hidden>↗</span>
                </a>
                <a className={styles.scrollCue} href="#experiencia">
                  {ABERTURA.scroll} <span aria-hidden>↓</span>
                </a>
              </div>
            </div>
          </section>

          <section
            id="experiencia"
            data-flight-section
            className={[styles.section, styles.darkSection, styles.experience].join(
              " "
            )}
            aria-labelledby="experience-title"
          >
            <div className={styles.sectionInner}>
              <SectionLabel current="01">{EXPERIENCIA.etiqueta}</SectionLabel>
              <div className={styles.editorialSplit}>
                <Reveal className={styles.statColumn}>
                  <p className={styles.statValue}>40</p>
                  <p className={styles.statCaption}>participantes</p>
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

            <div className={styles.disciplineTicker} aria-hidden>
              <div>
                TECNOLOGIA · CIÊNCIA · INOVAÇÃO · CRIATIVIDADE · EMPREENDEDORISMO ·
                TECNOLOGIA · CIÊNCIA · INOVAÇÃO · CRIATIVIDADE · EMPREENDEDORISMO ·
              </div>
            </div>
          </section>

          <section
            id="jornada"
            data-flight-section
            className={[styles.section, styles.darkSection, styles.journey].join(
              " "
            )}
            aria-labelledby="journey-title"
          >
            <div className={styles.sectionInner}>
              <SectionLabel current="02">{JORNADA.etiqueta}</SectionLabel>
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
                      ↘
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
              <SectionLabel current="03">{PROGRAMACAO.etiqueta}</SectionLabel>
              <div className={styles.scheduleGrid}>
                <Reveal className={styles.scheduleIntro}>
                  <p className={styles.scheduleKicker}>07—19H / FLORIANÓPOLIS</p>
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
                      <span>{String(index + 1).padStart(2, "0")}</span>
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
              <SectionLabel current="04">{MANIFESTO.etiqueta}</SectionLabel>
              <Reveal className={styles.manifestoCopy}>
                <h2 id="manifesto-title">{MANIFESTO.frase}</h2>
                <div className={styles.manifestoFoot}>
                  <p>{MANIFESTO.apoio}</p>
                  <p>{MANIFESTO.assinatura}</p>
                </div>
              </Reveal>
            </div>
            <p className={styles.manifestoGhost} aria-hidden>
              FLORIPA
            </p>
          </section>

          <section
            id="quem-conduz"
            data-flight-section
            className={[styles.section, styles.lightSection, styles.host].join(" ")}
            aria-labelledby="host-title"
          >
            <div className={styles.sectionInner}>
              <SectionLabel current="05">{QUEM_CONDUZ.etiqueta}</SectionLabel>
              <div className={styles.hostGrid}>
                <Reveal className={styles.portraitWrap}>
                  <figure>
                    <Image
                      src={QUEM_CONDUZ.foto}
                      alt={QUEM_CONDUZ.fotoAlt}
                      width={1168}
                      height={1301}
                      sizes="(max-width: 767px) 92vw, 48vw"
                    />
                    <figcaption>
                      {AUTORA.nome} / {AUTORA.handle}
                    </figcaption>
                  </figure>
                </Reveal>

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
              <SectionLabel current="06">{PARTICIPAR.etiqueta}</SectionLabel>
              <Reveal className={styles.ctaCopy}>
                <h2 id="participate-title">
                  <span className={styles.ctaCapacity}>
                    <span>{PARTICIPAR.titulo.split(" ")[0]}</span>{" "}
                    <span>{PARTICIPAR.titulo.split(" ").slice(1).join(" ")}</span>
                  </span>
                  <span>{PARTICIPAR.subtitulo}</span>
                </h2>
                <div className={styles.ctaBottom}>
                  <p>{PARTICIPAR.descricao}</p>
                  <a
                    className={styles.finalCta}
                    href={PARTICIPAR.botao.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {ABERTURA.cta} <span aria-hidden>↗</span>
                  </a>
                </div>
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
              width={520}
              height={339}
              sizes="86px"
            />
          </div>
          <div className={styles.footerMeta}>
            <p>Florianópolis / setembro 2026</p>
            <a href="#inicio">
              Voltar ao topo <span aria-hidden>↑</span>
            </a>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

export default MakeItFlyV2;
