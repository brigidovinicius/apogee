"use client";

import Image from "next/image";
import type { ScrollProgress } from "./scroll-progress";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";
import { startEarthScrubbing } from "./media-playback";

const MEDIA = "/media/earth-v2";
type Connection = EventTarget & { saveData?: boolean };
function connection() { return (navigator as Navigator & { connection?: Connection }).connection; }
function subscribeMotion(notify: () => void) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const viewport = window.matchMedia("(max-width: 660px)");
  motion.addEventListener("change", notify);
  viewport.addEventListener("change", notify);
  connection()?.addEventListener("change", notify);
  return () => {
    motion.removeEventListener("change", notify);
    viewport.removeEventListener("change", notify);
    connection()?.removeEventListener("change", notify);
  };
}
function mediaMode() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || connection()?.saveData) return "static";
  return window.matchMedia("(max-width: 660px)").matches ? "mobile" : "desktop";
}
const serverStatic = () => "static" as const;

export function EarthRadarScene({ progress }: { progress: ScrollProgress }) {
  const mode = useSyncExternalStore(subscribeMotion, mediaMode, serverStatic);
  return <SceneSurface key={mode} progress={progress} mode={mode} />;
}

function SceneSurface({ progress, mode }: { progress: ScrollProgress; mode: "static" | "mobile" | "desktop" }) {
  const root = useRef<HTMLDivElement>(null);
  const activate = useRef<(() => void) | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  // The sharp poster paints first; the multi-megabyte video waits for intent.
  useEffect(() => {
    if (mode === "static" || requested) return;
    function request() {
      const rect = root.current?.getBoundingClientRect();
      if (rect && rect.bottom > 0 && rect.top < window.innerHeight) setRequested(true);
    }
    if (window.scrollY > 0) request();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("wheel", request, { passive: true });
    window.addEventListener("touchstart", request, { passive: true });
    window.addEventListener("keydown", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("wheel", request);
      window.removeEventListener("touchstart", request);
      window.removeEventListener("keydown", request);
    };
  }, [mode, requested]);

  useEffect(() => {
    const media = video.current;
    if (!media || !requested || failed) return;
    const playback = startEarthScrubbing(media, progress, () => setReady(true), setBlocked);
    activate.current = playback.activate;
    return () => { activate.current = null; playback.dispose(); };
  }, [progress, requested, failed]);

  return <div ref={root} className={styles["earth-scene"]} data-earth-scene
    data-media-provider="gpt-image+google-flow"
    data-scene={failed ? "fallback" : mode === "static" ? "static" : ready ? "ready" : "poster"}
    role="group" aria-label="Terra azul clara vista do espaço, em um voo orbital">
    <div className={styles["earth-fallback"]} aria-hidden="true">
      <picture>
        <source media="(max-width: 660px)" srcSet={`${MEDIA}/earth-mobile-640.webp 640w, ${MEDIA}/earth-mobile-941.webp 941w`} sizes="100vw" />
        {/* Art-directed static WebP variants avoid fetching a landscape image on phones. */}
        <img src={`${MEDIA}/earth-desktop-1672.webp`} srcSet={`${MEDIA}/earth-desktop-960.webp 960w, ${MEDIA}/earth-desktop-1672.webp 1672w`}
          sizes="100vw" alt="" width={1672} height={941} fetchPriority="high" loading="eager" decoding="async" />
      </picture>
    </div>
    {requested && mode !== "static" && !failed && <video ref={video} className={styles["earth-video"]}
      src={mode === "mobile" ? `${MEDIA}/earth-mobile-flow-web.mp4` : "/design-preview/earth-cinematic-v1/earth-orbit-flow-scroll.mp4"}
      preload="metadata" muted playsInline disablePictureInPicture tabIndex={-1} aria-hidden="true"
      onError={() => setFailed(true)} />}
    {mode === "desktop" && requested && <Image className={styles["earth-detail"]}
      src={`${MEDIA}/earth-desktop-detail.webp`} alt="" fill sizes="100vw" unoptimized aria-hidden="true" />}
    {mode !== "static" && blocked && !failed && <button type="button" className={styles["earth-enable-motion"]}
      onClick={() => activate.current?.()}>Ativar movimento da Terra</button>}
  </div>;
}
