"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readMakeItFlyScroll, type MakeItFlyScrollPosition } from "@/lib/navigation/make-it-fly-scroll";

// Stay mounted across routes so a traversal can be restored after its DOM commits.
export function MakeItFlyScrollRestoration() {
  const pathname = usePathname();
  const pending = useRef<MakeItFlyScrollPosition | null>(null);
  const [traversal, setTraversal] = useState(0);

  useEffect(() => {
    const restore = (event: PopStateEvent) => {
      pending.current = readMakeItFlyScroll(event.state, window.location.href);
      setTraversal((value) => value + 1);
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  useLayoutEffect(() => {
    const position = pending.current;
    if (pathname !== "/makeitfly" || !position) return;
    const frame = window.requestAnimationFrame(() => {
      if (window.location.href === position.href) {
        // Native hash scrolling may run before the cached route is displayed.
        window.scrollTo({ left: position.left, top: position.top, behavior: "instant" });
      }
      pending.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, traversal]);

  return null;
}
