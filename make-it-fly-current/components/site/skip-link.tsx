"use client";

import type { MouseEvent } from "react";

export function SkipLink() {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const destination = new URL(window.location.href);
    destination.hash = "experiencia";
    // Next integrates native pushState with its router, preserving Back content.
    // Replace the fragment explicitly instead of appending to a cached route hash.
    if (destination.href !== window.location.href) window.history.pushState(null, "", destination.href);
    const target = document.getElementById("experiencia");
    target?.setAttribute("tabindex", "-1");
    target?.scrollIntoView({ block: "start", behavior: "instant" });
    target?.focus({ preventScroll: true });
  }

  return <a className="skip-link" href="#experiencia" onClick={follow}>Pular para o conteúdo</a>;
}
