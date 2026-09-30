"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { flushJourneyEvents, journeyPath, trackJourney } from "./journey-client";

const viewedSections = new Set<string>();
const reachedDepths = new Set<number>();
let lastPath = "";

export function JourneyTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const path = journeyPath(pathname);
    if (!path) return;
    if (lastPath !== path) {
      lastPath = path;
      trackJourney("page_view", path === "/" ? "landing" : "application");
    }

    const onPageHide = () => void flushJourneyEvents(true);
    const onVisibility = () => { if (document.visibilityState === "hidden") void flushJourneyEvents(true); };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    if (path !== "/") return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };

    const sections = [...document.querySelectorAll<HTMLElement>("[data-flight-section][id]")];
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).id;
        if (entry.isIntersecting && !viewedSections.has(id)) {
          viewedSections.add(id);
          trackJourney("section_view", id);
        }
      }
    }, { threshold: 0.35 });
    sections.forEach((section) => observer.observe(section));

    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const depth = Math.round((window.scrollY / scrollable) * 100);
      for (const milestone of [25, 50, 75, 100]) {
        if (depth >= milestone && !reachedDepths.has(milestone)) {
          reachedDepths.add(milestone);
          trackJourney("scroll_depth", String(milestone));
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname]);

  return null;
}
