import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminModeSwitcher } from "./admin-mode-switcher";
import { AdminNav } from "./admin-nav";
import styles from "./admin.module.css";

export function AdminShell({ children, showModeSwitcher }: { children: ReactNode; showModeSwitcher: boolean }) {
  return (
    <div className={styles.shell}>
      <header className={styles.mobileHeader}>
        <Link className={styles.mobileBrand} href="/admin" aria-label="Apogee Admin — painel">
          <Image src="/brand/apogee-logo-white.svg" alt="" width={1595} height={986} sizes="88px" />
          <span>Admin</span>
        </Link>
        <details className={styles.mobileMenu}>
          <summary>Menu</summary>
          <AdminNav compact />
        </details>
        {showModeSwitcher ? (
          <div className={styles.mobileModeSwitcher}>
            <AdminModeSwitcher mode="admin" />
          </div>
        ) : null}
      </header>

      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/admin" aria-label="Apogee Admin — painel">
          <Image src="/brand/apogee-logo-white.svg" alt="" width={1595} height={986} sizes="104px" />
          <span>Admin</span>
        </Link>
        {showModeSwitcher ? (
          <div className={styles.modeSwitcher}>
            <AdminModeSwitcher mode="admin" />
          </div>
        ) : null}
        <AdminNav />
        <div className={styles.sidebarFooter}>
          <span className={styles.environment}>Área restrita</span>
          <Link href="/membros">Ir para a área de membros</Link>
        </div>
      </aside>

      <main className={styles.main} id="experiencia">
        {children}
      </main>
    </div>
  );
}
