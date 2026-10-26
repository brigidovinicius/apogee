"use client";

import Image from "next/image";
import type { MotionValue } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";
import { startEarthScrubbing } from "./media-playback";

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
  const activate = useRef<(() => void) | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media || !canAnimate || failed) return;
    const playback = startEarthScrubbing(media, progress, () => setReady(true), setBlocked);
    activate.current = playback.activate;
    return () => { activate.current = null; playback.dispose(); };
  }, [progress, canAnimate, failed]);

  return <div className={styles["earth-scene"]} data-earth-scene
    data-media-provider="gpt-image+google-flow"
    data-scene={failed ? "fallback" : !canAnimate ? "static" : ready ? "ready" : "loading"}
    role="group" aria-label="Terra azul clara vista do espaço, em um voo orbital">
    <div className={styles["earth-fallback"]} aria-hidden="true">
      <Image src={`${MEDIA}/earth-opening-gpt.png`} alt="" fill priority unoptimized sizes="100vw" />
    </div>
    {canAnimate && !failed && <video ref={video} className={styles["earth-video"]}
      src={`${MEDIA}/earth-orbit-flow-scroll.mp4`} poster={`${MEDIA}/earth-opening-gpt.png`}
      preload="auto" muted playsInline disablePictureInPicture tabIndex={-1} aria-hidden="true"
      onError={() => setFailed(true)} />}
    {canAnimate && blocked && !failed && <button type="button" className={styles["earth-enable-motion"]}
      onClick={() => activate.current?.()}>Ativar movimento da Terra</button>}
  </div>;
}
