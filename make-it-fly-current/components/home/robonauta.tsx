"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import styles from "./robonauta.module.css";

type Side = "left" | "right";
type Mode = "idle" | Side;
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
  const idleVideo = useRef<HTMLVideoElement>(null);
  const leftVideo = useRef<HTMLVideoElement>(null);
  const rightVideo = useRef<HTMLVideoElement>(null);
  const attempt = useRef(0);
  const currentMode = useRef<Mode>("idle");
  const pointerSide = useRef<Side | null>(null);
  const queuedSide = useRef<Side | null>(null);
  const lastTouchSide = useRef<Side>("right");
  const failedModes = useRef(new Set<Mode>());
  const resetMode = useRef<Mode | null>(null);
  const touchStart = useRef<TouchStart | null>(null);
  const pageVisible = useSyncExternalStore(subscribeToVisibility, pageVisibility, serverVisibility);
  const [mode, setMode] = useState<Mode>("idle");
  const [visibleVideo, setVisibleVideo] = useState<Mode | null>(null);
  const [idleUnavailable, setIdleUnavailable] = useState(false);
  const active = pageVisible && !idleUnavailable;
  const showVideo = !idleUnavailable;

  const selectMode = useCallback((next: Mode) => {
    currentMode.current = next;
    resetMode.current = next;
    setMode(next);
  }, []);

  const handleMediaFailure = useCallback((failedMode: Mode) => {
    failedModes.current.add(failedMode);
    if (currentMode.current !== failedMode) return;
    queuedSide.current = null;
    if (failedMode === "idle") {
      setVisibleVideo(null);
      setIdleUnavailable(true);
    } else {
      // A missing directional clip must not disable the working idle animation.
      selectMode("idle");
    }
  }, [selectMode]);

  useEffect(() => {
    function resetWhenHidden() {
      if (!document.hidden) return;
      pointerSide.current = null;
      queuedSide.current = null;
      touchStart.current = null;
    }
    document.addEventListener("visibilitychange", resetWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", resetWhenHidden);
    };
  }, []);

  useEffect(() => {
    const idle = idleVideo.current;
    const left = leftVideo.current;
    const right = rightVideo.current;
    const currentAttempt = ++attempt.current;
    let cancelled = false;
    let autoplayBlocked = false;
    let queueTimer: ReturnType<typeof setTimeout> | undefined;
    idle?.pause();
    left?.pause();
    right?.pause();

    const video = mode === "idle" ? idle : mode === "left" ? left : right;
    function play() {
      if (!active || !video || cancelled) return;
      if (failedModes.current.has(mode)) {
        handleMediaFailure(mode);
        return;
      }
      autoplayBlocked = false;
      video.muted = true;
      void video.play().then(() => {
        if (cancelled || currentAttempt !== attempt.current) return;
        setVisibleVideo(mode);
        if (mode === "idle" && queuedSide.current !== null) {
          // Briefly restore neutral before playing the latest requested side.
          queueTimer = setTimeout(() => {
            if (cancelled || currentAttempt !== attempt.current || document.hidden || currentMode.current !== "idle") return;
            const next = queuedSide.current;
            queuedSide.current = null;
            if (next && !failedModes.current.has(next)) selectMode(next);
          }, 160);
        }
      }).catch((error: unknown) => {
        if (cancelled || currentAttempt !== attempt.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          autoplayBlocked = true;
          return;
        }
        handleMediaFailure(mode);
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
      if (queueTimer !== undefined) clearTimeout(queueTimer);
      document.removeEventListener("pointerdown", retryAfterGesture);
      document.removeEventListener("keydown", retryAfterGesture);
      idle?.pause();
      left?.pause();
      right?.pause();
    };
  }, [active, mode, handleMediaFailure, selectMode]);

  function requestSide(side: Side) {
    if (!active || failedModes.current.has(side)) return;
    if (currentMode.current !== "idle") {
      queuedSide.current = currentMode.current === side ? null : side;
      return;
    }
    queuedSide.current = null;
    selectMode(side);
  }

  function returnToIdle(endedSide: Side) {
    if (currentMode.current === endedSide) selectMode("idle");
  }

  function startTouch(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch") return;
    touchStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), moved: false };
  }

  function resetPointer() {
    touchStart.current = null;
    pointerSide.current = null;
    queuedSide.current = null;
  }

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      if (!active || !frame.current) return;
      const bounds = frame.current.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const x = (event.clientX - bounds.left) / bounds.width;
      // A 12% neutral zone, with 2% hysteresis to avoid boundary jitter.
      const next: Side | null = pointerSide.current === "left" && x < 0.46 ? "left"
        : pointerSide.current === "right" && x > 0.54 ? "right"
        : x < 0.44 ? "left" : x > 0.56 ? "right" : null;
      if (next === pointerSide.current) return;
      pointerSide.current = next;
      if (next === null) queuedSide.current = null;
      else requestSide(next);
      return;
    }
    const start = touchStart.current;
    if (start?.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) start.moved = true;
  }

  function finishTouch(event: PointerEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (start?.id !== event.pointerId || start.moved || performance.now() - start.time >= 600
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) return;
    const side = lastTouchSide.current === "left" ? "right" : "left";
    lastTouchSide.current = side;
    requestSide(side);
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
            preload={active ? "auto" : "none"}
            muted
            playsInline
            loop
            aria-hidden="true"
            tabIndex={-1}
            onError={() => handleMediaFailure("idle")}
          />
          <video
            ref={leftVideo}
            className={`${styles.video} ${showVideo && visibleVideo === "left" ? styles.visible : ""}`}
            src="/mascot/robonauta-olhar-esquerda.mp4"
            poster={poster}
            preload={active ? "auto" : "none"}
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => returnToIdle("left")}
            onError={() => handleMediaFailure("left")}
          />
          <video
            ref={rightVideo}
            className={`${styles.video} ${showVideo && visibleVideo === "right" ? styles.visible : ""}`}
            src="/mascot/robonauta-olhar-direita.mp4"
            poster={poster}
            preload={active ? "auto" : "none"}
            muted
            playsInline
            aria-hidden="true"
            tabIndex={-1}
            onEnded={() => returnToIdle("right")}
            onError={() => handleMediaFailure("right")}
          />
        </div>
      </div>
      <p className={styles.name}>Robonauta</p>
    </div>
  );
}
