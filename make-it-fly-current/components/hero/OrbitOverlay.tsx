"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";
import styles from "./apogee.module.css";

export function OrbitOverlay({ progress, compact, staticMode }: { progress: MotionValue<number>; compact: boolean; staticMode: boolean }) {
  const lineOpacity = useTransform(progress, [0.15, 0.4, 1], [0, 0.5, 0.28]);
  const pathLength = useTransform(progress, [0.15, 0.82, 1], [0, 0.94, 1]);
  const finalOpacity = useTransform(progress, [0.8, 0.94], [0, 1]);
  const phase = useTransform(progress, (p): string => p < 0.15 ? "01 / CONTATO" : p < 0.48 ? "02 / PARTIDA" : p < 0.82 ? "03 / TRAJETÓRIA" : "04 / APOGEU");
  const percent = useTransform(progress, p => `${Math.round(p * 100).toString().padStart(3, "0")}%`);

  return (
    <div className={styles.orbit} aria-hidden="true" data-static={staticMode ? "true" : undefined}>
      {!staticMode && <>
        <motion.svg className={styles.orbitDrawing} viewBox="0 0 1000 700" preserveAspectRatio="none" style={{ opacity: lineOpacity }}>
          <motion.path d="M 400 366 C 530 152 925 122 928 254 C 934 440 430 515 400 366 Z"
            fill="none" stroke="#939BA2" strokeWidth="0.65" vectorEffect="non-scaling-stroke" style={{ pathLength }} />
        </motion.svg>
        <div className={styles.readout}><motion.span>{phase}</motion.span><span className={styles.track}><motion.i style={{ scaleX: progress }} /></span><motion.span>{percent}</motion.span></div>
        <motion.div className={styles.apogeeLabel} style={{ opacity: finalOpacity, left: "78%", top: compact ? "34%" : "47%" }}>
          <span>APOGEE / MAX DISTANCE</span>
        </motion.div>
      </>}
    </div>
  );
}
