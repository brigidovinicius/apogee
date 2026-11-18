"use client";

import { useRef, type PointerEvent } from "react";
import { BrandMark } from "@/components/ui/brand-mark";
import styles from "./journal-home.module.css";

/** The original Apogee vector, with light following the pointer. No canvas or render loop. */
export function HomeStar() {
  const surface = useRef<HTMLDivElement>(null);
  function moveLight(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    surface.current?.style.setProperty("--light-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    surface.current?.style.setProperty("--light-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  }
  return <div className={styles.starStage} ref={surface} onPointerMove={moveLight}>
    <div className={styles.starHalo} aria-hidden="true" />
    <div className={styles.starBeam} aria-hidden="true" />
    <div className={styles.starFigure} role="img" aria-label="Estrela da Apogee">
      <BrandMark />
      <span className={styles.starShine} aria-hidden="true" />
    </div>
    <span className={styles.starCaption} aria-hidden="true">O próximo salto é seu.</span>
  </div>;
}
