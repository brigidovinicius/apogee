"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { behaviorPage, blogRadarArticle } from "@/lib/behavior-contract";
import { configureBehavior, flushBehavior, getBehaviorSnapshot, setBehaviorChoice, subscribeBehavior, trackBehavior } from "./behavior-client";
import styles from "./behavior.module.css";

export function BehaviorTracker() {
  const pathname = usePathname();
  const snapshot = useSyncExternalStore(subscribeBehavior, getBehaviorSnapshot, () => "pending");
  const allowed = snapshot === "allow";
  const ready = snapshot !== "pending";
  const choice = snapshot === "allow" || snapshot === "deny" ? snapshot : null;
  const refused = snapshot === "refused";
  const [editing, setEditing] = useState(false);
  const page = behaviorPage(pathname);
  useEffect(() => {
    configureBehavior(true);
    return () => configureBehavior(false);
  }, []);

  useEffect(() => {
    if (!page || !ready || !allowed) return;
    // One page view per navigation/effective consent change; no pre-consent events.
    trackBehavior("page_view", "view", page);
    const article = blogRadarArticle(pathname);
    if (article) trackBehavior("blog_radar_view", article, page);
    let clickedRadar = false;
    const depths = new Set<number>();
    const sections = new Set<string>();
    let visibleSeconds = 0;
    let lastTick = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min((now - lastTick) / 1000, 2);
      lastTick = now;
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      const previous = visibleSeconds;
      visibleSeconds += elapsed;
      for (const milestone of [15, 30, 60]) if (previous < milestone && visibleSeconds >= milestone) trackBehavior("engaged_time", `${milestone}s`, page);
    }, 1000);
    const scroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      if (height <= 0) return;
      const depth = window.scrollY / height * 100;
      for (const milestone of [25, 50, 75, 100]) if (depth >= milestone - 0.5 && !depths.has(milestone)) { depths.add(milestone); trackBehavior("scroll_depth", String(milestone), page); }
    };
    const click = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const filter = event.target.closest<HTMLElement>("[data-behavior-filter]");
      if (filter && filter.tagName !== "FORM") { trackBehavior("filter_apply", filter.dataset.behaviorFilter || "", page); return; }
      const action = event.target.closest<HTMLElement>("[data-behavior-action]");
      if (action && action.tagName !== "FORM" && !(action instanceof HTMLButtonElement && action.disabled)) { trackBehavior("action", action.dataset.behaviorAction || "", page); return; }
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link) return;
      try {
        const destination = new URL(link.href, window.location.origin);
        const target = destination.origin === window.location.origin ? behaviorPage(destination.pathname) : null;
        if (target) trackBehavior("navigation", target, page);
        if (article && !clickedRadar && event.isTrusted && (target === "radar_list" || target === "radar_detail") && link.closest("[data-blog-article-sources]")) {
          clickedRadar = true;
          trackBehavior("blog_radar_click", article, page);
          void flushBehavior();
        }
      } catch { /* Unrecognized links have no measurement. */ }
    };
    const auxClick = (event: MouseEvent) => {
      if (article && event.button === 1 && event.target instanceof Element && event.target.closest("[data-blog-article-sources] a[href]")) click(event);
    };
    const submit = (event: Event) => {
      if (!(event.target instanceof HTMLFormElement)) return;
      const filter = event.target.dataset.behaviorFilter;
      if (filter) { trackBehavior("filter_apply", filter, page); void flushBehavior(); }
      const action = event.target.dataset.behaviorAction;
      if (action) { trackBehavior("action", action, page); void flushBehavior(); }
    };
    const hide = () => void flushBehavior();
    const visibility = () => { lastTick = performance.now(); if (document.visibilityState === "hidden") hide(); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        const target = section.dataset.annualStage || section.id;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.35 && !sections.has(target)) {
          sections.add(target);
          trackBehavior("section_view", target, page);
        }
      }
    }, { threshold: 0.35 });
    const observeSections = () => document.querySelectorAll("[data-flight-section][id], [data-annual-stage]").forEach(section => observer?.observe(section));
    observeSections();
    // The pending checkout refreshes in place when the server confirms the invoice.
    const updates = observer && page === "annual_summary" ? new MutationObserver(observeSections) : null;
    if (updates) updates.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", scroll, { passive: true });
    document.addEventListener("click", click); document.addEventListener("submit", submit, true);
    if (article) document.addEventListener("auxclick", auxClick);
    window.addEventListener("pagehide", hide); document.addEventListener("visibilitychange", visibility);
    scroll();
    return () => {
      window.clearInterval(tick); observer?.disconnect(); updates?.disconnect();
      window.removeEventListener("scroll", scroll); document.removeEventListener("click", click); document.removeEventListener("submit", submit, true);
      if (article) document.removeEventListener("auxclick", auxClick);
      window.removeEventListener("pagehide", hide); document.removeEventListener("visibilitychange", visibility);
      void flushBehavior();
    };
  }, [pathname, page, ready, allowed]);

  if (!ready || !page) return null;
  const choose = (value: "allow" | "deny") => { setBehaviorChoice(value); setEditing(false); };
  if (refused) return <span className={styles.status}>Medição de uso desativada pelo navegador</span>;
  if (choice && !editing) return <button type="button" className={styles.settings} onClick={() => setEditing(true)}>Preferências de medição</button>;
  return <aside className={styles.panel} aria-label="Preferências de medição de uso">
    <strong>Podemos medir o uso do site?</strong>
    <p>Contamos páginas, cliques e etapas para melhorar a experiência. Sem identificar você nem registrar o que digita. Sua escolha pode ser alterada aqui.</p>
    <div><button type="button" onClick={() => choose("deny")}>Recusar</button><button type="button" onClick={() => choose("allow")}>Permitir medição</button></div>
  </aside>;
}
