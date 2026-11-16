"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MemberForumSection({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    function reveal() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (window.location.hash !== "#forum") return;
        section.current?.scrollIntoView({ block: "start", behavior: "instant" });
        section.current?.focus({ preventScroll: true });
      });
    }
    function follow(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href);
      if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.hash !== "#forum") return;
      // Keep same-page navigation native, then scroll after the mobile menu closes.
      event.preventDefault();
      if (destination.href !== window.location.href) window.history.pushState(null, "", destination.href);
      reveal();
    }

    // The streamed section may arrive after the router's initial fragment scroll.
    reveal();
    document.addEventListener("click", follow, true);
    window.addEventListener("hashchange", reveal);
    window.addEventListener("popstate", reveal);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", follow, true);
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("popstate", reveal);
    };
  }, []);

  return <section ref={section} id="forum" tabIndex={-1} aria-labelledby="member-forum-title" style={{ scrollMarginTop: "6rem" }}>{children}</section>;
}
