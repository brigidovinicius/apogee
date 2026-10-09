"use client";

import Image from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import styles from "./brand-presence.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";

function subscribeToMotion(callback: () => void) {
  const preference = window.matchMedia(motionQuery);
  preference.addEventListener("change", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    preference.removeEventListener("change", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function motionIsAvailable() {
  return !window.matchMedia(motionQuery).matches && !document.hidden;
}

// SSR and visitors without JavaScript receive the complete, still artwork.
const serverMotion = () => false;

export function BrandPresence() {
  const frame = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const motionAvailable = useSyncExternalStore(subscribeToMotion, motionIsAvailable, serverMotion);
  const moving = motionAvailable && inView && !paused;

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (!moving || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    // Translation only: the official symbol is never rotated, mirrored or deformed.
    event.currentTarget.style.setProperty("--presence-x", `${x * 12}px`);
    event.currentTarget.style.setProperty("--presence-y", `${y * 12}px`);
  }

  function resetPointer() {
    frame.current?.style.removeProperty("--presence-x");
    frame.current?.style.removeProperty("--presence-y");
  }

  function respondToTouch(event: PointerEvent<HTMLDivElement>) {
    if (!moving || event.pointerType === "mouse") return;
    event.currentTarget.dataset.pulse = "true";
  }

  return (
    <div className={styles.presence}>
      <div
        ref={frame}
        className={styles.artwork}
        data-motion={moving ? "on" : "off"}
        aria-hidden="true"
        onPointerMove={followPointer}
        onPointerLeave={resetPointer}
        onPointerCancel={resetPointer}
        onPointerDown={respondToTouch}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) delete event.currentTarget.dataset.pulse;
        }}
      >
        <div className={styles.aura} />
        <div className={styles.pulse} />
        <div className={styles.traveller}>
          <Image
            className={styles.symbol}
            src="/brand/apogee-star.svg"
            alt=""
            width={703}
            height={870}
            sizes="(max-width: 700px) 200px, (max-width: 1100px) 28vw, 360px"
            loading="eager"
            draggable={false}
          />
        </div>
        <div className={styles.ground} />
      </div>
      {motionAvailable && (
        <button
          type="button"
          className={styles.motionControl}
          aria-label={paused ? "Ativar movimento decorativo" : "Pausar movimento decorativo"}
          onClick={() => {
            resetPointer();
            setPaused((current) => !current);
          }}
        >
          {paused ? <Play size={13} aria-hidden="true" /> : <Pause size={13} aria-hidden="true" />}
          {paused ? "Ativar movimento" : "Pausar movimento"}
        </button>
      )}
    </div>
  );
}
