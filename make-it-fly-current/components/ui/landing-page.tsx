"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

/**
 * A cena 3D pesa (three + drei + 60k particulas): fica fora do bundle inicial
 * e nunca roda no servidor, onde nao ha WebGL.
 */
const MoonScene = dynamic(
  () => import("@/components/ui/moon-scene").then((m) => m.MoonScene),
  { ssr: false, loading: () => null }
);

export interface ScrollGlobeSection {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  description: string;
  align?: "left" | "center" | "right";
  features?: { title: string; description: string }[];
  actions?: {
    label: string;
    variant: "primary" | "secondary";
    onClick?: () => void;
  }[];
  /** Foto ao lado do texto (ignorada em secoes centralizadas). */
  image?: { src: string; alt: string; width: number; height: number };
  /** Revela o cinturao de asteroides ao chegar nesta secao. */
  revealAsteroids?: boolean;
}

export interface ScrollGlobePosition {
  top: string;
  left: string;
  scale: number;
  /** 0–1. Default 0.85; use valores baixos quando a lua fica atras do texto. */
  opacity?: number;
}

interface ScrollGlobeProps {
  sections: ScrollGlobeSection[];
  globeConfig?: {
    positions: ScrollGlobePosition[];
    /** Conjunto proprio para < 768px, onde nao ha espaco lateral livre. */
    mobilePositions?: ScrollGlobePosition[];
  };
  className?: string;
}

/**
 * Caixa em que a lua e rasterizada. Ela e depois escalada por CSS, entao a
 * caixa base e grande para nao borrar.
 *
 * ATENCAO ao mexer nos `scale` das posicoes: o R3F mede o container JA
 * transformado e dimensiona o canvas a partir disso, entao o scale entra ao
 * quadrado no tamanho final do canvas (scale 0.72 => ~0.52 do tamanho da caixa).
 */
const MOON_BOX_DESKTOP = 560;
const MOON_BOX_MOBILE = 420;

/** Quanto a lua persegue o alvo por quadro. Menor = mais suave e mais lento. */
const DAMPING = 0.085;

const defaultGlobeConfig: { positions: ScrollGlobePosition[] } = {
  positions: [
    { top: "50%", left: "84%", scale: 0.95 },
    { top: "30%", left: "18%", scale: 0.8 },
    { top: "62%", left: "86%", scale: 1.0 },
    { top: "50%", left: "50%", scale: 1.25, opacity: 0.3 },
  ],
};

const parsePercent = (str: string): number => parseFloat(str.replace("%", ""));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Suaviza a passagem de uma secao para a outra (ease-in-out). */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export function ScrollGlobe({
  sections,
  globeConfig = defaultGlobeConfig,
  className,
}: ScrollGlobeProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [asteroidsRevealed, setAsteroidsRevealed] = useState(false);
  const [compact, setCompact] = useState(false);
  const [contentEntered, setContentEntered] = useState(false);

  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const moonRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const positions = useMemo(
    () =>
      (compact && globeConfig.mobilePositions
        ? globeConfig.mobilePositions
        : globeConfig.positions
      ).map((pos) => ({
        top: parsePercent(pos.top),
        left: parsePercent(pos.left),
        scale: pos.scale,
        opacity: pos.opacity ?? 0.85,
      })),
    [globeConfig.positions, globeConfig.mobilePositions, compact]
  );

  // Alvo (definido pelo scroll) e valor corrente (perseguindo o alvo por quadro).
  const target = useRef({ ...positions[0] });
  const current = useRef({ ...positions[0] });
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
      setReducedMotion(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /** Le o scroll e calcula o alvo continuo — sem setState por quadro. */
  const readScroll = useCallback(() => {
    const doc = document.documentElement;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

    if (progressRef.current) {
      progressRef.current.style.transform = `scaleX(${Math.min(
        Math.max(progress, 0),
        1
      )})`;
    }

    const centers = sectionRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.top + window.scrollY + rect.height / 2;
    });
    if (centers.length === 0) return;

    const viewCenter = window.scrollY + window.innerHeight / 2;
    const hasEntered = window.scrollY >= window.innerHeight * 0.45;
    setContentEntered((previous) =>
      previous === hasEntered ? previous : hasEntered
    );

    // Posicao continua entre as secoes: e isso que torna o movimento fluido,
    // em vez de saltar de uma posicao fixa para a proxima.
    let index = 0;
    let t = 0;
    if (viewCenter <= centers[0]) {
      index = 0;
    } else if (viewCenter >= centers[centers.length - 1]) {
      index = centers.length - 1;
    } else {
      for (let i = 0; i < centers.length - 1; i++) {
        if (viewCenter >= centers[i] && viewCenter <= centers[i + 1]) {
          index = i;
          const span = centers[i + 1] - centers[i];
          t = span > 0 ? (viewCenter - centers[i]) / span : 0;
          break;
        }
      }
    }

    const from = positions[Math.min(index, positions.length - 1)];
    const to = positions[Math.min(index + 1, positions.length - 1)];
    const e = smoothstep(t);

    target.current = {
      top: lerp(from.top, to.top, e),
      left: lerp(from.left, to.left, e),
      scale: lerp(from.scale, to.scale, e),
      opacity: lerp(from.opacity, to.opacity, e),
    };

    const nearest = Math.round(index + t);
    setActiveSection((prev) => (prev === nearest ? prev : nearest));

    if (sections[nearest]?.revealAsteroids) {
      setAsteroidsRevealed((prev) => prev || true);
    }

  }, [positions, sections]);

  // O laco abaixo precisa ser criado uma unica vez. Guardando readScroll numa
  // ref, o efeito deixa de depender da identidade de `sections`/`positions`
  // — que mudam a cada render e faziam o efeito remontar, cancelando o
  // requestAnimationFrame antes de ele disparar (a lua nunca era desenhada).
  // Ao alternar desktop <-> mobile o conjunto de posicoes muda: reposiciona na hora.
  useEffect(() => {
    const p = positions[0];
    current.current = { ...p };
    target.current = { ...p };
    if (moonRef.current) {
      moonRef.current.style.transform = `translate3d(${p.left}vw, ${p.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${p.scale}, ${p.scale}, 1)`;
      moonRef.current.style.opacity = String(p.opacity);
    }
  }, [positions]);

  const readScrollRef = useRef(readScroll);
  useEffect(() => {
    readScrollRef.current = readScroll;
  }, [readScroll]);


  useEffect(() => {
    // Pinta a posicao inicial JA, de forma sincrona. O requestAnimationFrame
    // fica pausado em aba de segundo plano / economia de bateria, e se a lua
    // dependesse so dele ficaria presa em opacity 0 — invisivel para sempre.
    const inicial = positions[0];
    if (moonRef.current) {
      moonRef.current.style.transform = `translate3d(${inicial.left}vw, ${inicial.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${inicial.scale}, ${inicial.scale}, 1)`;
      moonRef.current.style.opacity = String(inicial.opacity);
    }

    let raf: number | undefined;
    let rodando = false;

    // Persegue o alvo com amortecimento e escreve direto no DOM — sem
    // re-render por quadro, o que mantem o movimento fluido.
    const passo = () => {
      const c = current.current;
      const tg = target.current;
      const k = reducedRef.current ? 1 : DAMPING;

      c.top = lerp(c.top, tg.top, k);
      c.left = lerp(c.left, tg.left, k);
      c.scale = lerp(c.scale, tg.scale, k);
      c.opacity = lerp(c.opacity, tg.opacity, k);

      if (moonRef.current) {
        moonRef.current.style.transform = `translate3d(${c.left}vw, ${c.top}vh, 0) translate3d(-50%, -50%, 0) scale3d(${c.scale}, ${c.scale}, 1)`;
        moonRef.current.style.opacity = String(c.opacity);
      }

      const parado =
        Math.abs(c.top - tg.top) < 0.01 &&
        Math.abs(c.left - tg.left) < 0.01 &&
        Math.abs(c.scale - tg.scale) < 0.001 &&
        Math.abs(c.opacity - tg.opacity) < 0.001;

      if (parado) {
        rodando = false;
        return;
      }
      raf = requestAnimationFrame(passo);
    };

    const acordar = () => {
      if (rodando) return;
      rodando = true;
      raf = requestAnimationFrame(passo);
    };

    const onScroll = () => {
      readScrollRef.current();
      acordar();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    // Medicao inicial fora do corpo do efeito (evita render em cascata).
    raf = requestAnimationFrame(onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      rodando = false;
    };
    // positions[0] e estavel: vem de useMemo sobre a config passada por prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={cn(
        "relative min-h-screen w-full max-w-full overflow-x-hidden bg-flight-ink font-sans text-flight-white",
        className
      )}
    >
      <div aria-hidden className="flight-grain pointer-events-none fixed inset-0 z-[1]" />

      {/* Um unico fio de progresso, como uma trajetoria no ceu. */}
      <div className="fixed left-0 top-0 z-50 h-px w-full bg-flight-white/8">
        <div
          ref={progressRef}
          className="h-full origin-left bg-flight-sky will-change-transform"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      {/* Navegacao lateral */}
      <nav
        aria-label="Seções"
        className={cn(
          "fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-300 sm:flex lg:right-8",
          contentEntered
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <div className="space-y-4 lg:space-y-5">
          {sections.map((section, index) => (
            <div key={section.id} className="group relative">
              <div
                className={cn(
                  "absolute right-9 top-1/2 -translate-y-1/2 lg:right-12",
                  "z-50 whitespace-nowrap border border-flight-white/12 bg-flight-ink/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-flight-ice opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 lg:px-4 lg:py-2"
                )}
              >
                {section.badge || `Seção ${index + 1}`}
              </div>

              <button
                type="button"
                onClick={() =>
                  sectionRefs.current[index]?.scrollIntoView({
                    behavior: reducedMotion ? "auto" : "smooth",
                    block: "center",
                  })
                }
                className={cn(
                  "relative block h-5 w-10 after:absolute after:right-0 after:top-1/2 after:h-px after:-translate-y-1/2 after:transition-all after:duration-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flight-sky",
                  activeSection === index
                    ? "after:w-9 after:bg-flight-sky"
                    : "after:w-4 after:bg-flight-white/28 hover:after:w-7 hover:after:bg-flight-white/70"
                )}
                aria-label={`Ir para ${section.badge || `seção ${index + 1}`}`}
                aria-current={activeSection === index ? "true" : undefined}
              />
            </div>
          ))}
        </div>
      </nav>

      {/* A lua — no lugar do globo terrestre */}
      {/*
        Sem prop `style` aqui de proposito: o laco de animacao escreve
        transform/opacity direto no DOM, e qualquer style gerenciado pelo React
        seria reescrito a cada re-render — foi o que deixava a lua em opacity 0.
        O estado inicial invisivel vem da classe (inline style depois vence).
      */}
      <div
        ref={moonRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-10 opacity-0 will-change-transform"
      >
        <div
          style={{
            width: compact ? MOON_BOX_MOBILE : MOON_BOX_DESKTOP,
            height: compact ? MOON_BOX_MOBILE : MOON_BOX_DESKTOP,
          }}
        >
          <MoonScene
            reducedMotion={reducedMotion}
            showAsteroids={asteroidsRevealed}
            compact={compact}
          />
        </div>
      </div>

      {/* Seções */}
      {sections.map((section, index) => {
        const comFoto = Boolean(section.image) && section.align !== "center";

        return (
          <section
            key={section.id}
            id={section.id}
            ref={(el) => {
              sectionRefs.current[index] = el;
            }}
            className={cn(
              "relative z-20 flex min-h-[100svh] w-full max-w-full flex-col justify-center overflow-hidden border-t border-flight-white/[0.055] px-5 py-24 sm:px-8 md:px-10 lg:min-h-[100dvh] lg:px-12 lg:py-28 xl:px-16",
              index === 0 && "max-md:justify-end",
              section.align === "center" && "items-center text-center",
              section.align === "right" && "items-end text-right",
              section.align !== "center" &&
                section.align !== "right" &&
                "items-start text-left"
            )}
          >
            <div
              className={cn(
                "w-full max-w-none sm:max-w-xl md:max-w-2xl lg:max-w-5xl",
                comFoto && "lg:max-w-7xl"
              )}
            >
              <div
                className={cn(
                  comFoto &&
                    "grid items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20"
                )}
              >
                <div
                  className={cn(
                    section.align === "right" && comFoto &&
                      "lg:col-start-2 lg:row-start-1"
                  )}
                >
                  {section.badge && (
                    <p
                      className={cn(
                        "mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-flight-sky sm:text-[11px]",
                        section.align === "right" && "justify-end",
                        section.align === "center" && "justify-center"
                      )}
                    >
                      <span className="h-px w-8 bg-flight-sky/55" />
                      {section.badge}
                    </p>
                  )}

                  <h2
                    className={cn(
                      "mb-7 text-balance font-display font-semibold uppercase leading-[0.9] tracking-[-0.025em] text-flight-white sm:mb-8",
                      section.align === "center"
                        ? "mx-auto max-w-[16ch] text-[clamp(3.25rem,8vw,8.5rem)]"
                        : "text-[clamp(3.1rem,6.4vw,7.2rem)]",
                      section.id === "participar" && "max-w-[11ch]"
                    )}
                  >
                    {section.subtitle ? (
                      <span className="block">
                        <span className="block">{section.title}</span>
                        <span className="mt-3 block max-w-[22ch] text-[0.42em] font-medium leading-[1.02] tracking-[0.035em] text-flight-ice/74 sm:text-[0.38em]">
                          {section.subtitle}
                        </span>
                      </span>
                    ) : (
                      section.title
                    )}
                  </h2>

                  <p
                    className={cn(
                      "mb-9 max-w-[56ch] text-[0.98rem] leading-[1.75] text-flight-ice/78 sm:mb-11 sm:text-[1.05rem]",
                      section.align === "center" && "mx-auto"
                    )}
                  >
                    {section.description}
                  </p>

                  {section.features && (
                    <div className="mb-9 grid border-t border-flight-white/16 sm:mb-11 sm:grid-cols-2">
                      {section.features.map((feature) => (
                        <div
                          key={feature.title}
                          className="group border-b border-flight-white/16 py-5 text-left transition-colors duration-300 sm:odd:border-r sm:odd:pr-5 sm:even:pl-5 sm:hover:bg-flight-white/[0.025]"
                        >
                          <h3 className="font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-flight-sky sm:text-[0.72rem]">
                            {feature.title}
                          </h3>
                          <p className="mt-2.5 max-w-[38ch] text-sm leading-relaxed text-flight-ice/72 sm:text-[0.94rem]">
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {section.actions && (
                    <div
                      className={cn(
                        "flex flex-col flex-wrap gap-3 sm:flex-row sm:gap-4",
                        section.align === "center" && "justify-center",
                        section.align === "right" && "justify-end",
                        (!section.align || section.align === "left") &&
                          "justify-start"
                      )}
                    >
                      {section.actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className={cn(
                            "group w-full sm:w-auto",
                            action.variant === "primary"
                              ? "flight-button"
                              : "flight-button flight-button--secondary"
                          )}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {comFoto && section.image && (
                  <figure
                    className={cn(
                      "relative overflow-hidden border border-flight-white/14 bg-flight-navy",
                      section.align === "right" &&
                        "lg:col-start-1 lg:row-start-1"
                    )}
                  >
                    <Image
                      src={section.image.src}
                      alt={section.image.alt}
                      width={section.image.width}
                      height={section.image.height}
                      className="aspect-[4/5] h-full w-full object-cover object-top saturate-[0.82]"
                      sizes="(max-width: 1024px) 100vw, 42vw"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_68%,rgba(2,8,23,0.5))]" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-px w-2/3 bg-flight-sky" />
                  </figure>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ScrollGlobe;
