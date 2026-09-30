"use client";

import { useEffect, useState, type RefObject } from "react";
import { useMotionValue, useScroll, useTransform } from "framer-motion";
import { nextSceneVersion } from "@/lib/apogee-motion-policy";
import { flightAnchors, flightProgress } from "@/lib/apogee-scroll";

export function useApogeeTimeline(pageRef: RefObject<HTMLElement | null>) {
  const [environment, setEnvironment] = useState({ mounted: false, compact: false, lowPower: false, sceneVersion: 0 });
  const [visible, setVisible] = useState(true);
  const { scrollY } = useScroll();
  const anchors = useMotionValue<number[]>([0, 1]);
  const progress = useTransform(() => flightProgress(scrollY.get(), anchors.get()));

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;
    const sections = Array.from(page.querySelectorAll<HTMLElement>("[data-flight-section]"));
    // Measure on layout changes, not per animation frame. Anchor links and
    // restored scroll positions resolve to the same camera frame immediately.
    const syncGeometry = () => {
      anchors.set(flightAnchors(sections.map(section => section.getBoundingClientRect().top + window.scrollY),
        window.innerHeight, document.documentElement.scrollHeight));
      scrollY.set(window.scrollY);
    };
    const observer = new ResizeObserver(syncGeometry);
    observer.observe(page);
    sections.forEach(section => observer.observe(section));
    window.addEventListener("resize", syncGeometry);
    syncGeometry();
    return () => { observer.disconnect(); window.removeEventListener("resize", syncGeometry); };
  }, [pageRef, scrollY, anchors]);

  useEffect(() => {
    const compact = matchMedia("(max-width: 767px)");
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const sync = () => setEnvironment((previous) => {
      const lowPower = Boolean(nav.connection?.saveData || (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2));
      return {
        mounted: true, compact: compact.matches, lowPower,
        // A readiness callback belongs only to the scene that produced it.
        sceneVersion: nextSceneVersion(previous, { lowPower }),
      };
    });
    sync();
    compact.addEventListener("change", sync);
    return () => compact.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  return { progress, visible, ...environment };
}
