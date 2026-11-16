"use client";

import { useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import styles from "./member-navigation.module.css";

export function MemberNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return <aside className={styles.sidebar} aria-label="Menu de membros" onKeyDown={event => {
    if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); }
  }}>
    <a href="#conteudo-membro" className={styles.skip}>Pular navegação de membros</a>
    <button ref={toggle} className={styles.toggle} type="button" aria-expanded={open} aria-controls="navegacao-membro" onClick={() => setOpen(!open)}>
      {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />} Menu de membros
    </button>
    <div id="navegacao-membro" className={styles.navigation} data-open={open} onClick={event => {
      if ((event.target as Element).closest("a")) setOpen(false);
    }}>{children}</div>
  </aside>;
}
