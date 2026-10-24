"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";

const MEDIA = "/design-preview/apogee-signature-v3";
// Clipe do Flow retimado para 8s/60fps: brilho lento sem reduzir a cadência.
const serverStatic = () => false;
function subscribeMotion(notify: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", notify);
  return () => preference.removeEventListener("change", notify);
}
function motionAllowed() {
  const device = navigator as Navigator & { connection?: { saveData?: boolean } };
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !device.connection?.saveData;
}

export function EarthSignature() {
  const canAnimate = useSyncExternalStore(subscribeMotion, motionAllowed, serverStatic);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media || !canAnimate || finished || failed) return;
    function syncVisibility() {
      if (!media) return;
      if (document.hidden) media.pause();
      else if (!media.ended) void media.play().catch((error: unknown) => {
        // A aba pode ficar oculta antes de o play pendente terminar.
        if (!(error instanceof DOMException && error.name === "AbortError")) setFailed(true);
      });
    }
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      media.pause();
    };
  }, [canAnimate, finished, failed]);

  return <div className={styles["earth-signature"]} data-earth-signature
    data-signature-state={!canAnimate ? "static" : failed ? "fallback" : finished ? "complete" : playing ? "playing" : "loading"}
    role="img" aria-label="Apogee, assinatura manuscrita e estrela">
    <Image className={styles["earth-signature-art"]} src={`${MEDIA}/signature-gpt.png`}
      alt="" width={1672} height={940} sizes="(max-width: 440px) 92vw, 400px" loading="eager" unoptimized draggable={false} />
    {canAnimate && !finished && !failed && <video ref={video}
      className={styles["earth-signature-video"]} src={`${MEDIA}/signature-light-flow-smooth-60fps.mp4`}
      poster={`${MEDIA}/signature-gpt.png`} preload="auto" muted playsInline disablePictureInPicture
      aria-hidden="true" tabIndex={-1} onPlaying={() => setPlaying(true)}
      onEnded={() => setFinished(true)} onError={() => setFailed(true)} />}
  </div>;
}
