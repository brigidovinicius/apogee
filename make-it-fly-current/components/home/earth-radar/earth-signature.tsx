"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";
import { resolveSignatureMode, startSignatureLoop } from "./media-playback";

const MEDIA = "/design-preview/apogee-signature-v3";
// Clipe do Flow retimado para 8s/60fps: brilho lento sem reduzir a cadência.
const serverStatic = () => "static" as const;
function subscribeMotion(notify: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touch = window.matchMedia("(pointer: coarse)");
  preference.addEventListener("change", notify);
  touch.addEventListener("change", notify);
  return () => {
    preference.removeEventListener("change", notify);
    touch.removeEventListener("change", notify);
  };
}
function motionMode() {
  const device = navigator as Navigator & { connection?: { saveData?: boolean } };
  return resolveSignatureMode({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    touch: window.matchMedia("(pointer: coarse)").matches,
    saveData: Boolean(device.connection?.saveData),
  });
}

export function EarthSignature() {
  const mode = useSyncExternalStore(subscribeMotion, motionMode, serverStatic);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "playing" | "waiting" | "blocked">("loading");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media || mode !== "video" || failed) return;
    return startSignatureLoop(media, setState);
  }, [mode, failed]);

  const shimmer = mode !== "static" && (mode === "lightweight" || failed || state === "blocked");
  useEffect(() => {
    const element = root.current;
    if (!element || !shimmer) return;
    let visible = true;
    const update = () => element.style.setProperty("--signature-play-state", !document.hidden && visible ? "running" : "paused");
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [shimmer]);

  return <div ref={root} className={styles["earth-signature"]} data-earth-signature
    data-signature-state={mode === "static" ? "static" : shimmer ? "shimmer" : state}
    role="img" aria-label="Apogee, assinatura manuscrita e estrela">
    <Image className={styles["earth-signature-art"]} src={`${MEDIA}/signature-gpt.png`}
      alt="" width={1672} height={940} sizes="(max-width: 440px) 92vw, 400px" loading="eager" unoptimized draggable={false} />
    {/* A mesma arte recorta o brilho nas letras e na estrela, sem autoplay no celular. */}
    <svg className={styles["earth-signature-shimmer"]} viewBox="0 0 1672 940" aria-hidden="true" focusable="false">
      <defs>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="1672" height="940" style={{ maskType: "luminance" }}>
          <image href={`${MEDIA}/signature-gpt.png`} width="1672" height="940" />
        </mask>
        <linearGradient id={`${id}-light`}>
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset=".3" stopColor="white" stopOpacity=".2" />
          <stop offset=".5" stopColor="white" />
          <stop offset=".7" stopColor="white" stopOpacity=".2" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g mask={`url(#${id}-mask)`}>
        <rect className={styles["earth-signature-sweep"]} width="680" height="940" fill={`url(#${id}-light)`} />
      </g>
    </svg>
    {mode === "video" && !failed && <video ref={video}
      className={styles["earth-signature-video"]} src={`${MEDIA}/signature-light-flow-smooth-60fps.mp4`}
      poster={`${MEDIA}/signature-gpt.png`} preload="auto" muted playsInline disablePictureInPicture
      aria-hidden="true" tabIndex={-1} onError={() => setFailed(true)} />}
  </div>;
}
