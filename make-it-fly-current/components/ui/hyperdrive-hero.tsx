"use client";

import Image from "next/image";
import {
  motion,
  MotionConfig,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HyperdriveHeroProps {
  editionLabel?: string;
  title?: string;
  titleEmphasis?: string;
  subtitle?: string;
  description?: string;
  meta?: readonly string[];
  creatorLabel?: string;
  supportLabel?: string;
  supportLogoSrc?: string;
  supportLogoAlt?: string;
  ctaLabel?: string;
  scrollHint?: string;
  scrollTargetId?: string;
  className?: string;
}

const rise: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (step: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.18 + step * 0.12,
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const titleLine: Variants = {
  hidden: { y: "112%" },
  visible: (step: number) => ({
    y: 0,
    transition: {
      delay: 0.14 + step * 0.12,
      duration: 0.92,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};

/**
 * Abertura editorial do evento. O warp ocupa o fundo global e a lua vive na
 * camada seguinte; por isso esta secao permanece transparente.
 */
export default function HyperdriveHero({
  editionLabel = "Florianópolis / setembro 2026",
  title = "Make it",
  titleEmphasis = "fly",
  subtitle = "Tire uma ideia do papel — em um dia.",
  description =
    "Chegue com uma ideia, trabalhe em profundidade e termine o dia mostrando um resultado.",
  meta = ["Florianópolis", "Setembro 2026", "40 participantes"],
  creatorLabel = "Uma iniciativa de Rosa Maria",
  supportLabel = "Apoio oficial",
  supportLogoSrc = "/partners/red-bull.png",
  supportLogoAlt = "Red Bull",
  ctaLabel = "Quero participar do evento",
  scrollHint = "Conheça a experiência",
  scrollTargetId = "experiencia",
  className,
}: HyperdriveHeroProps) {
  const prefersReducedMotion = useReducedMotion();

  const irParaOSite = () => {
    const alvo = document.getElementById(scrollTargetId);
    const behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth";

    if (alvo) {
      alvo.scrollIntoView({ behavior, block: "start" });
      return;
    }

    window.scrollTo({ top: window.innerHeight, behavior });
  };

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="opening-title"
        className={cn(
          "relative z-20 flex min-h-[100svh] w-full overflow-hidden bg-transparent text-flight-white md:min-h-[100dvh]",
          className
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_46%,rgba(49,105,187,0.14),transparent_31%),linear-gradient(to_bottom,rgba(1,5,14,0.1),rgba(1,5,14,0.68))]"
        />
        <div aria-hidden className="flight-grain absolute inset-0 -z-10" />

        <div className="mx-auto flex w-full max-w-[96rem] flex-col px-5 pb-7 pt-5 sm:px-8 sm:pb-8 sm:pt-7 lg:px-12 xl:px-16">
          <motion.header
            custom={0}
            variants={rise}
            initial="hidden"
            animate="visible"
            className="hero-fade flex min-h-16 items-start justify-between gap-5 border-b border-flight-white/18 pb-4"
          >
            <div className="flex items-center gap-3 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-flight-ice/78 sm:text-[0.68rem]">
              <span className="h-px w-8 bg-flight-sky" />
              <span>{editionLabel}</span>
            </div>

            <div className="flex shrink-0 items-start gap-4 sm:gap-7">
              <p className="hidden max-w-28 pt-1 text-right font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.18em] text-flight-ice/60 sm:block">
                {creatorLabel}
              </p>
              {supportLogoSrc && (
                <div className="flex items-start gap-2.5 border-l border-flight-white/18 pl-4 sm:pl-6">
                  <span className="max-w-12 pt-1 text-right font-mono text-[0.45rem] uppercase leading-relaxed tracking-[0.12em] text-flight-ice/55 sm:max-w-none sm:text-[0.55rem] sm:tracking-[0.18em]">
                    {supportLabel}
                  </span>
                  <Image
                    src={supportLogoSrc}
                    alt={supportLogoAlt}
                    width={520}
                    height={339}
                    priority
                    unoptimized
                    className="h-auto w-[4.8rem] object-contain sm:w-[5.5rem]"
                    sizes="88px"
                  />
                </div>
              )}
            </div>
          </motion.header>

          <div className="grid flex-1 content-center py-8 sm:py-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)] lg:items-end lg:gap-10 lg:py-12">
            <h1
              id="opening-title"
              aria-label={`${title} ${titleEmphasis}`}
              className="font-display uppercase"
            >
              <span className="block overflow-hidden">
                <motion.span
                  custom={0}
                  variants={titleLine}
                  initial="hidden"
                  animate="visible"
                  className="hero-fade block pl-[0.08em] text-[clamp(2.3rem,6vw,5.9rem)] font-semibold leading-[0.86] tracking-[0.28em] text-flight-ice"
                >
                  {title}
                </motion.span>
              </span>
              <span className="block overflow-hidden">
                <motion.span
                  custom={1}
                  variants={titleLine}
                  initial="hidden"
                  animate="visible"
                  className="hero-fade -ml-[0.025em] block text-[clamp(8.8rem,22vw,22rem)] font-bold leading-[0.72] tracking-[-0.055em] text-flight-white"
                >
                  {titleEmphasis}
                </motion.span>
              </span>
            </h1>

            <div className="relative z-20 mt-8 max-w-xl border-t border-flight-white/22 pt-5 sm:mt-10 sm:pt-6 lg:mb-2 lg:mt-0 lg:max-w-sm">
              <motion.p
                custom={3}
                variants={rise}
                initial="hidden"
                animate="visible"
                className="hero-fade font-display text-[clamp(1.9rem,3.3vw,3.25rem)] font-semibold leading-[0.94] tracking-[-0.025em] text-flight-white"
              >
                {subtitle}
              </motion.p>
              <motion.p
                custom={4}
                variants={rise}
                initial="hidden"
                animate="visible"
                className="hero-fade mt-5 max-w-[48ch] text-sm leading-relaxed text-flight-ice/72 sm:text-base"
              >
                {description}
              </motion.p>
              <motion.div
                custom={5}
                variants={rise}
                initial="hidden"
                animate="visible"
                className="hero-fade mt-7"
              >
                <button
                  type="button"
                  onClick={irParaOSite}
                  className="flight-button group"
                >
                  <span>{ctaLabel}</span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                  />
                </button>
              </motion.div>
            </div>
          </div>

          <motion.footer
            custom={6}
            variants={rise}
            initial="hidden"
            animate="visible"
            className="hero-fade flex items-end justify-between gap-5 border-t border-flight-white/18 pt-4"
          >
            <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-flight-ice/60 sm:gap-x-8 sm:text-[0.66rem]">
              {meta.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <button
              type="button"
              onClick={irParaOSite}
              className="group hidden shrink-0 items-center gap-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-flight-ice/55 transition-colors duration-300 hover:text-flight-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-flight-sky sm:flex"
              aria-label={scrollHint}
            >
              <span>{scrollHint}</span>
              <motion.span
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronDown aria-hidden className="h-4 w-4" />
              </motion.span>
            </button>
          </motion.footer>
        </div>
      </section>
    </MotionConfig>
  );
}
