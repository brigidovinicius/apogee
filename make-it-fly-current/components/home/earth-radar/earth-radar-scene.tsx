"use client";

import Image from "next/image";
import type { MotionValue } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";

const MEDIA = "/design-preview/earth-cinematic-v1";
function subscribeMotion(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
function canRenderMotion() {
  const device = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !device.connection?.saveData;
}
const serverFalse = () => false;

export function EarthRadarScene({ progress }: { progress: MotionValue<number> }) {
  const canAnimate = useSyncExternalStore(subscribeMotion, canRenderMotion, serverFalse);
  return <SceneSurface key={canAnimate ? "animated" : "static"} progress={progress} canAnimate={canAnimate} />;
}

function SceneSurface({ progress, canAnimate }: { progress: MotionValue<number>; canAnimate: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media || !canAnimate) return;
    let frame = 0;
    // O vídeo fica pausado. A rolagem controla o tempo da câmera no Flow.
    // Durante um seek, conservamos só o destino mais recente para evitar uma fila de decodificação.
    function sync() {
      frame = 0;
      if (!media || media.readyState < 2 || !Number.isFinite(media.duration) || media.seeking) return;
      const value = Math.min(1, Math.max(0, progress.get()));
      const target = value * Math.max(0, media.duration - 1 / 30);
      if (Math.abs(media.currentTime - target) > 1 / 60) media.currentTime = target;
      if (container.current) container.current.dataset.videoProgress = String(value);
    }
    function schedule() {
      if (!frame) frame = window.requestAnimationFrame(sync);
    }
    const unsubscribe = progress.on("change", schedule);
    media.addEventListener("loadeddata", schedule);
    media.addEventListener("seeked", schedule);
    media.addEventListener("canplay", schedule);
    schedule();
    return () => {
      unsubscribe();
      window.cancelAnimationFrame(frame);
      media.removeEventListener("loadeddata", schedule);
      media.removeEventListener("seeked", schedule);
      media.removeEventListener("canplay", schedule);
    };
  }, [progress, canAnimate]);

  return <div ref={container} className={styles["earth-scene"]} data-earth-scene
    data-media-provider="gpt-image+google-flow"
    data-scene={failed ? "fallback" : !canAnimate ? "static" : ready ? "ready" : "loading"}
    role="img" aria-label="Terra azul clara vista do espaço, em um voo orbital">
    <div className={styles["earth-fallback"]} aria-hidden="true">
      <Image src={`${MEDIA}/earth-opening-gpt.png`} alt="" fill priority unoptimized sizes="100vw" />
    </div>
    {canAnimate && !failed && <video ref={video} className={styles["earth-video"]}
      src={`${MEDIA}/earth-orbit-flow-scroll.mp4`} poster={`${MEDIA}/earth-opening-gpt.png`}
      preload="auto" muted playsInline disablePictureInPicture tabIndex={-1} aria-hidden="true"
      onLoadedData={() => setReady(true)} onError={() => setFailed(true)} />}
  </div>;
}
