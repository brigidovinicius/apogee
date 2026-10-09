"use client";

import Image from "next/image";
import { Pause, Play, Sparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import styles from "./robonauta.module.css";

type Mode = "idle" | "reaction";
type TouchStart = { id: number; x: number; y: number; time: number; moved: boolean };

const motionQuery = "(prefers-reduced-motion: reduce)";
const poster = "/mascot/robonauta-poster.webp";

function subscribeToEnvironment(callback: () => void) {
  const preference = window.matchMedia(motionQuery);
  preference.addEventListener("change", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    preference.removeEventListener("change", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}

function environmentSnapshot() {
  return (window.matchMedia(motionQuery).matches ? 1 : 0) | (document.hidden ? 2 : 0);
}

// The server renders the complete poster without starting a video.
const serverEnvironment = () => 7;

export function Robonauta() {
  const stageId = useId();
  const frame = useRef<HTMLDivElement>(null);
  const idleVideo = useRef<HTMLVideoElement>(null);
  const reactionVideo = useRef<HTMLVideoElement>(null);
  const attempt = useRef(0);
  const reactionInFlight = useRef(false);
  const cooldownUntil = useRef(0);
  const resetMode = useRef<Mode | null>(null);
  const touchStart = useRef<TouchStart | null>(null);
  const environment = useSyncExternalStore(subscribeToEnvironment, environmentSnapshot, serverEnvironment);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [optedIn, setOptedIn] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [visibleVideo, setVisibleVideo] = useState<Mode | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const reduced = (environment & 1) !== 0;
  const hidden = (environment & 2) !== 0;
  const hydrated = (environment & 4) === 0;
  const motionAllowed = !reduced || optedIn;
  const enabled = hydrated && motionAllowed && !paused && !unavailable;
  const active = enabled && inView && !hidden;
  const showVideo = motionAllowed && !unavailable && visibleVideo === mode;

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const preference = window.matchMedia(motionQuery);
    function resetPreference() {
      setOptedIn(false);
      setVisibleVideo(null);
      reactionInFlight.current = false;
      resetMode.current = "idle";
      setMode("idle");
    }
    preference.addEventListener("change", resetPreference);
    return () => preference.removeEventListener("change", resetPreference);
  }, []);

  useEffect(() => {
    const idle = idleVideo.current;
    const reaction = reactionVideo.current;
    const currentAttempt = ++attempt.current;
    let cancelled = false;
    idle?.pause();
    reaction?.pause();

    const video = mode === "idle" ? idle : reaction;
    if (active && video) {
      if (resetMode.current === mode) {
        if (video.readyState > 0) video.currentTime = 0;
        resetMode.current = null;
      }
      video.muted = true;
      void video.play().then(() => {
        if (!cancelled && currentAttempt === attempt.current) setVisibleVideo(mode);
      }).catch((error: unknown) => {
        if (cancelled || currentAttempt !== attempt.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setPaused(true);
          return;
        }
        setUnavailable(true);
      });
    }

    return () => {
      cancelled = true;
      attempt.current += 1;
      idle?.pause();
      reaction?.pause();
    };
  }, [active, mode]);

  function react() {
    if (!active || reactionInFlight.current || performance.now() < cooldownUntil.current) return;
    reactionInFlight.current = true;
    resetMode.current = "reaction";
    setVisibleVideo(null);
    setMode("reaction");
  }

  function returnToIdle() {
    reactionInFlight.current = false;
    cooldownUntil.current = performance.now() + 500;
    resetMode.current = "idle";
    setVisibleVideo(null);
    setMode("idle");
  }

  function startTouch(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
  }

  function trackTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) start.moved = true;
  }

  function finishTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start?.id === event.pointerId && !start.moved && performance.now() - start.time < 600
      && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 10) react();
  }

  function toggleMotion() {
    if (unavailable) return;
    if (enabled) setPaused(true);
    else {
      setOptedIn(true);
      setPaused(false);
    }
  }

  return (
    <div className={styles.mascot}>
      <div
        id={stageId}
        ref={frame}
        className={styles.stage}
        onPointerEnter={(event) => { if (event.pointerType === "mouse" || event.pointerType === "pen") react(); }}
        onPointerDown={startTouch}
        onPointerMove={trackTouch}
        onPointerUp={finishTouch}
        onPointerCancel={() => { touchStart.current = null; }}
        onPointerLeave={() => { touchStart.current = null; }}
      >
        <div className={styles.artwork}>
          <Image
            className={styles.poster}
            src={poster}
            alt="Robonauta, o mascote da Apogee, com olhos humanos na tela de um monitor e suéter claro."
            fill
            sizes="(max-width: 760px) 100vw, 720px"
            preload
            draggable={false}
          />
          <video
            ref={idleVideo}
            className={`${styles.video} ${showVideo && mode === "idle" ? styles.visible : ""}`}
            src="/mascot/robonauta-repouso.mp4"
            poster={poster}
            preload="none"
            muted
            playsInline
            loop
            aria-hidden="true"
            tabIndex={-1}
            onError={() => { if (mode === "idle") setUnavailable(true); }}
          />
          <video
            ref={reactionVideo}
            className={`${styles.video} ${showVideo && mode === "reaction" ? styles.visible : ""}`}
            src="/mascot/robonauta-reacao.mp4"
            poster={poster}
            preload="none"
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            onEnded={returnToIdle}
            onError={() => { if (mode === "reaction") setUnavailable(true); }}
          />
        </div>
      </div>
      <div className={styles.controls} aria-label="Animação do Robonauta">
        <span className={styles.name}>Robonauta</span>
        <button type="button" onClick={toggleMotion} aria-controls={stageId} disabled={unavailable || !hydrated}>
          {enabled ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          {enabled ? "Pausar animação" : "Reproduzir animação"}
        </button>
        <button type="button" onClick={react} aria-controls={stageId} disabled={!active || mode === "reaction"}>
          <Sparkles size={13} aria-hidden="true" />
          Reagir
        </button>
      </div>
      <p className={styles.status} role="status" aria-live="polite">
        {unavailable ? "A animação está indisponível no momento." : ""}
      </p>
    </div>
  );
}
