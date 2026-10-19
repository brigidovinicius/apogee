"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./editorial-home.module.css";

export function HomeMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false;
    let observer: IntersectionObserver | undefined;
    const controls: Array<{ stop(): void }> = [];
    const nodes = [...element.querySelectorAll<HTMLElement>("[data-home-reveal]")];
    function stop() {
      observer?.disconnect();
      controls.forEach((control) => control.stop());
      nodes.forEach((node) => { node.style.transform = "none"; node.style.opacity = "1"; });
    }
    function sync() {
      stop();
      if (paused || preference.matches || document.hidden) return;
      void import("framer-motion").then(({ animate }) => {
        if (disposed || paused || preference.matches || document.hidden) return;
        observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer?.unobserve(entry.target);
            const node = entry.target as HTMLElement;
            if (node.dataset.homeSeen) continue;
            node.dataset.homeSeen = "true";
            controls.push(animate(node, { opacity: [0.6, 1], y: [24, 0] }, {
              duration: 0.7, delay: Number(node.dataset.homeDelay ?? 0), ease: [0.22, 1, 0.36, 1],
            }));
          }
        }, { threshold: 0.12 });
        nodes.forEach((node) => observer?.observe(node));
      }).catch(() => { /* Content is visible without the animation library. */ });
    }
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      disposed = true;
      stop();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused]);

  return <div ref={root} className={styles.page} data-motion={paused ? "off" : "on"}>
    <noscript><style>{`.${styles.motionControl}{display:none}`}</style></noscript>
    {children}
    <button type="button" className={styles.motionControl} aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
      {paused ? "Retomar movimento" : "Pausar movimento"}
    </button>
  </div>;
}
