"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { MotionValue } from "framer-motion";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { APOGEE_FOV, apogeeDistance, sampleApogee, smoothApogee } from "@/lib/apogee-config";
import styles from "./earth-radar.module.css";

// Mesmas texturas, esfera, atmosfera e rotação do Make It Fly.
const EarthCanvas = dynamic(() => import("@/components/hero/EarthCanvas"), { ssr: false, loading: () => null });

function samplePreviewCamera(progress: number, compact: boolean, aspect: number) {
  const sample = sampleApogee(progress * 0.7, compact, aspect);
  // Horizonte largo e centralizado como na fotografia, seguido do voo existente.
  const openingDiameter = compact ? 5.8 : 3.2;
  const openingDistance = apogeeDistance(openingDiameter, aspect);
  const blend = smoothApogee(progress / 0.6);
  const distance = openingDistance + (sample.distance - openingDistance) * blend;
  const openingCenterY = 0.32 + openingDiameter * aspect / 2;
  return {
    ...sample,
    distance,
    diameterRatio: 1 / (Math.sqrt(distance * distance - 1) * Math.tan(APOGEE_FOV * Math.PI / 360) * aspect),
    center: [0.5 + (sample.center[0] - 0.5) * blend, openingCenterY + (sample.center[1] - openingCenterY) * blend] as const,
    camera: sample.camera.map(value => value * distance / sample.distance) as [number, number, number],
  };
}

function subscribeMedia(query: string, notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const subscribeMotion = (notify: () => void) => subscribeMedia("(prefers-reduced-motion: reduce)", notify);
const subscribeCompact = (notify: () => void) => subscribeMedia("(max-width: 767px)", notify);
function canRenderMotion() {
  const device = navigator as Navigator & { connection?: { saveData?: boolean } };
  // O navegador integrado pode informar limites conservadores de hardware.
  // A cena já limita resolução e só desenha quando a rolagem muda.
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && !device.connection?.saveData;
}
const readCompact = () => window.matchMedia("(max-width: 767px)").matches;
const serverFalse = () => false;
function subscribeVisibility(notify: () => void) {
  document.addEventListener("visibilitychange", notify);
  return () => document.removeEventListener("visibilitychange", notify);
}
const readVisibility = () => !document.hidden;

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export function EarthRadarScene({ progress }: { progress: MotionValue<number> }) {
  const canAnimate = useSyncExternalStore(subscribeMotion, canRenderMotion, serverFalse);
  const compact = useSyncExternalStore(subscribeCompact, readCompact, serverFalse);
  const documentVisible = useSyncExternalStore(subscribeVisibility, readVisibility, serverFalse);
  // Recomeça a prontidão ao alternar a preferência de movimento.
  return <SceneSurface key={canAnimate ? "animated" : "static"} progress={progress}
    canAnimate={canAnimate} compact={compact} documentVisible={documentVisible} />;
}

function SceneSurface({ progress, canAnimate, compact, documentVisible }: {
  progress: MotionValue<number>; canAnimate: boolean; compact: boolean; documentVisible: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => setFailed(true), []);
  const rendered = canAnimate && ready && !failed;

  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return <div ref={container} className={styles["earth-scene"]} data-earth-scene
    data-scene={failed ? "fallback" : !canAnimate ? "static" : rendered ? "ready" : "loading"}
    role="img" aria-label="Terra vista do espaço">
    <div className={styles["earth-fallback"]} aria-hidden="true">
      <Image src="/design-preview/earth-horizon.png" alt="" fill priority unoptimized sizes="100vw" />
    </div>
    {canAnimate && !failed && <div className={styles["earth-canvas"]} aria-hidden="true">
      <SceneBoundary onError={onError}>
        <EarthCanvas progress={progress} compact={compact} active={inView && documentVisible}
          onReady={onReady} onError={onError} sampleCamera={samplePreviewCamera} appearance="horizon" />
      </SceneBoundary>
    </div>}
  </div>;
}
