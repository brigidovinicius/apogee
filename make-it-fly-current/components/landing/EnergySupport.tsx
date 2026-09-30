"use client";

import Image from "next/image";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import { ABERTURA } from "@/content/site";
import styles from "./energy-support.module.css";

export function EnergySupport() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 86,
    damping: 28,
    mass: 0.28,
  });
  const messageScale = useTransform(progress, [0, 0.5, 1], [0.82, 1, 1.06]);
  const messageY = useTransform(progress, [0, 0.5, 1], ["-8vh", "-12vh", "-20vh"]);
  const preludeOpacity = useTransform(progress, [0, 0.2, 0.82, 1], [0.28, 1, 1, 0.46]);
  const firstLineX = useTransform(progress, [0, 0.5, 1], ["-20vw", "0vw", "7vw"]);
  const secondLineX = useTransform(progress, [0, 0.5, 1], ["20vw", "0vw", "-7vw"]);
  const canX = useTransform(progress, [0, 0.5, 1], ["32vw", "0vw", "-32vw"]);
  const canY = useTransform(progress, [0, 0.5, 1], ["10vh", "-2vh", "-10vh"]);
  const canRotate = useTransform(progress, [0, 0.5, 1], [-15, 0, 12]);
  const canScale = useTransform(progress, [0, 0.5, 1], [0.72, 1.08, 0.86]);
  const glowScale = useTransform(progress, [0, 0.5, 1], [0.78, 1.18, 0.92]);

  return (
    <aside
      ref={sectionRef}
      id="energia"
      data-flight-section
      className={styles.support}
      aria-labelledby="energy-support-title"
    >
      <div className={styles.stickyScene}>
        <motion.div
          aria-hidden
          className={styles.glow}
          style={{ scale: glowScale }}
        />

        <motion.div
          className={styles.message}
          style={{ scale: messageScale, y: messageY }}
        >
          <h3 id="energy-support-title" className={styles.statement}>
            <motion.span
              className={styles.prelude}
              style={{ opacity: preludeOpacity }}
            >
              {ABERTURA.apoio.mensagem.contexto}
            </motion.span>
            <motion.span className={styles.firstLine} style={{ x: firstLineX }}>
              {ABERTURA.apoio.mensagem.destaque}
            </motion.span>
            <motion.span className={styles.secondLine} style={{ x: secondLineX }}>
              {ABERTURA.apoio.mensagem.marca}
            </motion.span>
          </h3>
        </motion.div>

        <motion.div
          className={styles.artwork}
          style={{ x: canX, y: canY, rotate: canRotate, scale: canScale }}
        >
          <Image
            className={styles.can}
            src={ABERTURA.apoio.logo}
            alt={ABERTURA.apoio.logoAlt}
            width={1726}
            height={4918}
            sizes="(max-width: 767px) 22vw, 9vw"
          />
        </motion.div>
      </div>
    </aside>
  );
}
