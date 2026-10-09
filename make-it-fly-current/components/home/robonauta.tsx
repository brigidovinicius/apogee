"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import styles from "./robonauta.module.css";

type Mode = "idle" | "reaction";
type TouchStart = { id: number; x: number; y: number; time: number; moved: boolean };

const poster = "/mascot/robonauta-poster.webp";

function subscribeToVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

const pageVisibility = () => !document.hidden;
const serverVisibility = () => false;

export function Robonauta() {
  const frame = useRef<HTMLDivElement>(null);
  const motionLayer = useRef<HTMLDivElement>(null);
  const pointerFrame = useRef<number | null>(null);
  const pointerPosition = useRef({ x: 0, y: 0 });
  const idleVideo = useRef<HTMLVideoElement>(null);
  const reactionVideo = useRef<HTMLVideoElement>(null);
  const attempt = useRef(0);
  const reactionInFlight = useRef(false);
  const cooldownUntil = useRef(0);
  const resetMode = useRef<Mode | null>(null);
  const touchStart = useRef<TouchStart | null>(null);
  const pageVisible = useSyncExternalStore(subscribeToVisibility, pageVisibility, serverVisibility);
  const [mode, setMode] = useState<Mode>("idle");
  const [visibleVideo, setVisibleVideo] = useState<Mode | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const active = pageVisible && !unavailable;
  const showVideo = !unavailable;

  useEffect(() => {
    function resetWhenHidden() {
      if (document.hidden) resetPointer();
    }
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", resetWhenHidden);
      if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
    };
  }, []);

  useEffect(() => {
    const idle = idleVideo.current;
    const reaction = reactionVideo.current;
    const currentAttempt = ++attempt.current;
    let cancelled = false;
    let autoplayBlocked = false;
    idle?.pause();
    reaction?.pause();

    const video = mode === "idle" ? idle : reaction;
    function play() {
      if (!active || !video || cancelled) return;
      autoplayBlocked = false;
      video.muted = true;
      void video.play().then(() => {
        if (!cancelled && currentAttempt === attempt.current) setVisibleVideo(mode);
      }).catch((error: unknown) => {
        if (cancelled || currentAttempt !== attempt.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          autoplayBlocked = true;
          return;
        }
        setUnavailable(true);
      });
    }

    // Retry within a real gesture if the browser disallows muted autoplay.
    function retryAfterGesture() {
      if (autoplayBlocked) play();
    }

    if (active && video) {
      if (resetMode.current === mode) {
        if (video.readyState > 0) video.currentTime = 0;
        resetMode.current = null;
      }
      play();
    }

    document.addEventListener("pointerdown", retryAfterGesture, { passive: true });
    document.addEventListener("keydown", retryAfterGesture);

    return () => {
      cancelled = true;
      attempt.current += 1;
      document.removeEventListener("pointerdown", retryAfterGesture);
      document.removeEventListener("keydown", retryAfterGesture);
      idle?.pause();
      reaction?.pause();
    };
  }, [active, mode]);

  function react() {
    if (!active || reactionInFlight.current || performance.now() < cooldownUntil.current) return;
    reactionInFlight.current = true;
    resetMode.current = "reaction";
    setMode("reaction");
  }

  function returnToIdle() {
    reactionInFlight.current = false;
    cooldownUntil.current = performance.now() + 500;
    resetMode.current = "idle";
    setMode("idle");
  }

  function startTouch(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
  }

  function resetPointer() {
    touchStart.current = null;
    if (pointerFrame.current !== null) cancelAnimationFrame(pointerFrame.current);
    pointerFrame.current = null;
    pointerPosition.current = { x: 0, y: 0 };
    motionLayer.current?.style.setProperty("--robonauta-x", "0");
    motionLayer.current?.style.setProperty("--robonauta-y", "0");
  }

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      if (!active || !frame.current) return;
      react();
      const bounds = frame.current.getBoundingClientRect();
      pointerPosition.current = {
        x: Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2)),
        y: Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2)),
      };
      if (pointerFrame.current === null) {
        pointerFrame.current = requestAnimationFrame(() => {
          pointerFrame.current = null;
          const { x, y } = pointerPosition.current;
          motionLayer.current?.style.setProperty("--robonauta-x", x.toFixed(3));
          motionLayer.current?.style.setProperty("--robonauta-y", y.toFixed(3));
        });
      }
      return;
    }
    const start = touchStart.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) start.moved = true;
  }

  function finishTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start?.id === event.pointerId && !start.moved && performance.now() - start.time < 600
      && Math.hypot(event.clientX - start.x, event.clientY - start.y) <= 10) react();
  }

  return (
    <div className={styles.mascot}>
      <div
        ref={frame}
        className={styles.stage}
        onPointerEnter={trackPointer}
        onPointerDown={startTouch}
        onPointerMove={trackPointer}
        onPointerUp={finishTouch}
        onPointerCancel={resetPointer}
        onPointerLeave={resetPointer}
      >
        <div className={styles.artwork}>
          <div ref={motionLayer} className={styles.motion}>
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
              className={`${styles.video} ${showVideo && visibleVideo === "idle" ? styles.visible : ""}`}
              src="/mascot/robonauta-repouso.mp4"
              poster={poster}
              preload="auto"
              autoPlay
              muted
              playsInline
              loop
              aria-hidden="true"
              tabIndex={-1}
              onError={() => { if (mode === "idle") setUnavailable(true); }}
            />
            <video
              ref={reactionVideo}
              className={`${styles.video} ${showVideo && visibleVideo === "reaction" ? styles.visible : ""}`}
              src="/mascot/robonauta-reacao.mp4"
              poster={poster}
              preload={active ? "auto" : "none"}
              muted
              playsInline
              aria-hidden="true"
              tabIndex={-1}
              onEnded={returnToIdle}
              onError={() => { if (mode === "reaction") setUnavailable(true); }}
            />
          </div>
        </div>
      </div>
      <p className={styles.name}>Robonauta</p>
    </div>
  );
}
