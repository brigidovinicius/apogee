"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import styles from "./admin.module.css";

const liveItems = [
  { href: "/admin", label: "Painel", exact: true },
  { href: "/admin/radar", label: "Radar", exact: false },
  { href: "/admin/posts", label: "Blog", exact: false },
  { href: "/admin/convites", label: "Convites", exact: false },
  { href: "/admin/usuarios", label: "Usuários", exact: false },
  { href: "/admin/protecao", label: "Cadastros protegidos", exact: false },
  { href: "/admin/loja/drops", label: "Cadastros dos drops", exact: false },
] as const;

const plannedItems = ["Moderação", "Assinaturas", "Conciliação", "Fila e jobs", "Auditoria"];

export function AdminNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const closeMobileMenu = () => {
    const menu = navigationRef.current?.closest("details");
    if (!menu) return;
    menu.open = false;
    menu.querySelector("summary")?.focus();
  };

  return (
    <nav ref={navigationRef} className={compact ? styles.compactNav : styles.navigation} aria-label="Administração">
      <p className={styles.navLabel}>Operação</p>
      {liveItems.map((item) => {
        const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link href={item.href} key={item.href} aria-current={current ? "page" : undefined}
            onNavigate={compact ? closeMobileMenu : undefined}>
            <span aria-hidden>{item.label.slice(0, 2).toUpperCase()}</span>
            {item.label}
          </Link>
        );
      })}
      <p className={styles.navLabel}>Dependem de contrato</p>
      {plannedItems.map((label) => (
        <span className={styles.disabledNavItem} aria-disabled="true" key={label}>
          <span aria-hidden> - </span>
          {label}
          <small>Indisponível</small>
        </span>
      ))}
    </nav>
  );
}
