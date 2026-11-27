"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import styles from "./member-navigation.module.css";

export function MemberNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && !sidebar.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("click", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("click", dismiss);
    };
  }, [open]);

  return <aside ref={sidebar} className={styles.sidebar} aria-label="Menu de membros" onKeyDown={event => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      toggle.current?.focus();
    }
  }}>
    <a href="#conteudo-membro" className={styles.skip}>Pular navegação de membros</a>
    <button ref={toggle} className={styles.toggle} type="button" aria-expanded={open} aria-controls="navegacao-membro" onClick={() => setOpen(current => !current)}>
      {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} Menu de membros
    </button>
    <div id="navegacao-membro" className={styles.navigation} data-open={open} onClick={event => {
      if ((event.target as Element).closest("a")) setOpen(false);
    }}>{children}</div>
  </aside>;
}
