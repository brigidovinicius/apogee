"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./earth-radar.module.css";
import { startSignatureLoop } from "./media-playback";

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
  const [state, setState] = useState<"loading" | "playing" | "waiting" | "blocked">("loading");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const media = video.current;
    if (!media || !canAnimate || failed) return;
    return startSignatureLoop(media, setState);
  }, [canAnimate, failed]);

  return <div className={styles["earth-signature"]} data-earth-signature
    data-signature-state={!canAnimate ? "static" : failed ? "fallback" : state}
    role="img" aria-label="Apogee, assinatura manuscrita e estrela">
    <Image className={styles["earth-signature-art"]} src={`${MEDIA}/signature-gpt.png`}
      alt="" width={1672} height={940} sizes="(max-width: 440px) 92vw, 400px" loading="eager" unoptimized draggable={false} />
    {canAnimate && !failed && <video ref={video}
      className={styles["earth-signature-video"]} src={`${MEDIA}/signature-light-flow-smooth-60fps.mp4`}
      poster={`${MEDIA}/signature-gpt.png`} preload="auto" muted playsInline disablePictureInPicture
      aria-hidden="true" tabIndex={-1} onError={() => setFailed(true)} />}
  </div>;
}
