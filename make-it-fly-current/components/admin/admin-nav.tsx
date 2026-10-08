"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const liveItems = [
  { href: "/admin", label: "Painel", exact: true },
  { href: "/admin/curadoria", label: "Curadoria", exact: false },
  { href: "/admin/posts/novo", label: "Posts", exact: false },
  { href: "/admin/usuarios", label: "Usuários", exact: false },
] as const;

const plannedItems = ["Fontes", "Moderação", "Assinaturas", "Conciliação", "Fila e jobs", "Auditoria"];

export function AdminNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className={compact ? styles.compactNav : styles.navigation} aria-label="Administração">
      <p className={styles.navLabel}>Operação</p>
      {liveItems.map((item) => {
        const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link href={item.href} key={item.href} aria-current={current ? "page" : undefined}>
            <span aria-hidden>{item.label.slice(0, 2).toUpperCase()}</span>
            {item.label}
          </Link>
        );
      })}
      <p className={styles.navLabel}>Dependem de contrato</p>
      {plannedItems.map((label) => (
        <span className={styles.disabledNavItem} aria-disabled="true" key={label}>
          <span aria-hidden>—</span>
          {label}
          <small>Indisponível</small>
        </span>
      ))}
    </nav>
  );
}
