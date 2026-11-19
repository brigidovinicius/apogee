"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./site-shell.module.css";

const desktopMenus = {
  more: { label: "Mais", control: "Mais seções", region: "Outras seções" },
  resources: { label: "Área de membros", control: "Área de membros", region: "Recursos da área de membros" },
};

export function SiteMobileNavigation({ children, variant }: { children: ReactNode; variant?: keyof typeof desktopMenus }) {
  const details = useRef<HTMLDetailsElement>(null);
  const navigationId = useId();
  const [open, setOpen] = useState(false);
  const menu = variant && desktopMenus[variant];

  useEffect(() => {
    const element = details.current;
    if (!element) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !element.contains(event.target)) element.open = false;
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element.open) return;
      event.preventDefault();
      element.open = false;
      element.querySelector("summary")?.focus();
    };
    const dismissHidden = () => {
      if (!element.getClientRects().length) element.open = false;
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape);
    window.addEventListener("resize", dismissHidden);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape);
      window.removeEventListener("resize", dismissHidden);
    };
  }, []);

  return <details ref={details} className={menu ? styles.moreNavigation : styles.mobileNavigation} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary aria-label={menu?.control ?? (open ? "Fechar navegação" : "Abrir navegação")} aria-controls={navigationId}>{menu?.label ?? "Menu"}</summary>
    <nav id={navigationId} aria-label={menu?.region ?? "Navegação móvel"} onClick={(event) => {
      if (event.target instanceof Element && event.target.closest("a[href]") && details.current) details.current.open = false;
    }}>{children}</nav>
  </details>;
}
