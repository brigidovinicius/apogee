"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { pointerToHeadPose, type HeadPose } from "@/lib/robonauta-motion";
import styles from "./robonauta.module.css";

type SceneController = {
  setTarget(pose: HeadPose, tracking: boolean): void;
  setActive(active: boolean): void;
  dispose(): void;
};

export function Robonauta() {
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mountedStage = frame.current;
    const mountedSurface = canvas.current;
    if (!mountedStage || !mountedSurface) return;
    const stage = mountedStage;
    const surface = mountedSurface;
    const hero = stage.closest("section") ?? stage;
    let controller: SceneController | undefined;
    let cancelled = false;
    let failed = false;
    let touchPointer: number | null = null;
    let target: HeadPose = { yaw: 0, pitch: 0 };
    let tracking = false;
    const initialBounds = stage.getBoundingClientRect();
    let inViewport = initialBounds.bottom > 0 && initialBounds.top < window.innerHeight &&
      initialBounds.right > 0 && initialBounds.left < window.innerWidth;

    function resetPointer() {
      touchPointer = null;
      target = { yaw: 0, pitch: 0 };
      tracking = false;
      controller?.setTarget(target, false);
    }

    function syncActivity() {
      const active = !document.hidden && inViewport && !failed;
      if (!active) resetPointer();
      controller?.setActive(active);
    }

    function isInsideHero(event: PointerEvent) {
      const bounds = hero.getBoundingClientRect();
      return event.clientX >= bounds.left && event.clientX <= bounds.right &&
        event.clientY >= bounds.top && event.clientY <= bounds.bottom &&
        event.target instanceof Node && hero.contains(event.target);
    }

    function updatePointer(event: PointerEvent) {
      if (document.hidden || !inViewport || failed) return;
      if (event.pointerType === "touch" && touchPointer !== event.pointerId) return;
      if (!isInsideHero(event)) {
        resetPointer();
        return;
      }
      const bounds = stage.getBoundingClientRect();
      target = pointerToHeadPose(event.clientX, event.clientY, {
        left: bounds.left + bounds.width * 0.18,
        top: bounds.top + bounds.height * 0.02,
        width: bounds.width * 0.64,
        height: bounds.height * 0.64,
      });
      tracking = true;
      controller?.setTarget(target, true);
    }

    function pointerDown(event: PointerEvent) {
      if (event.pointerType === "touch") {
        if (!event.isPrimary || !isInsideHero(event)) return;
        touchPointer = event.pointerId;
      }
      updatePointer(event);
    }

    function pointerUp(event: PointerEvent) {
      if (touchPointer === event.pointerId) resetPointer();
    }

    function pointerOut(event: PointerEvent) {
      if (event.relatedTarget === null) resetPointer();
    }

    function handleError() {
      if (cancelled || failed) return;
      failed = true;
      setReady(false);
      resetPointer();
      controller?.dispose();
      controller = undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      syncActivity();
    });
    observer.observe(stage);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", pointerDown, { passive: true });
    window.addEventListener("pointerup", pointerUp, { passive: true });
    window.addEventListener("pointercancel", resetPointer, { passive: true });
    window.addEventListener("pointerout", pointerOut, { passive: true });
    window.addEventListener("blur", resetPointer);
    document.addEventListener("visibilitychange", syncActivity);

    void import("./robonauta-scene")
      .then(({ createRobonautaScene }) => {
        if (cancelled) return;
        return createRobonautaScene(surface, () => {
          if (!cancelled && !failed) setReady(true);
        }, handleError);
      })
      .then((scene) => {
        if (!scene) return;
        if (cancelled || failed) {
          scene.dispose();
          return;
        }
        controller = scene;
        controller.setTarget(target, tracking);
        syncActivity();
      })
      .catch(handleError);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", resetPointer);
      window.removeEventListener("pointerout", pointerOut);
      window.removeEventListener("blur", resetPointer);
      document.removeEventListener("visibilitychange", syncActivity);
      controller?.dispose();
    };
  }, []);

  return (
    <div className={styles.mascot}>
      <div ref={frame} className={styles.stage}>
        <div className={styles.artwork}>
          <Image
            className={`${styles.poster} ${ready ? styles.posterHidden : ""}`}
            src="/mascot/robonauta-poster.webp"
            alt="Robonauta, o mascote da Apogee, com olhos humanos na tela de um monitor e suéter claro."
            fill
            sizes="(max-width: 760px) 100vw, 720px"
            preload
            draggable={false}
          />
          <canvas
            ref={canvas}
            className={`${styles.canvas} ${ready ? styles.visible : ""}`}
            aria-hidden="true"
            data-ready={ready}
          />
        </div>
      </div>
      <p className={styles.name}>Robonauta</p>
    </div>
  );
}
