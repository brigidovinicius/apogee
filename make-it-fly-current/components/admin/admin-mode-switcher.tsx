import Link from "next/link";
import styles from "./admin-mode-switcher.module.css";

type AdminMode = "admin" | "user";

export function AdminModeSwitcher({ mode }: { mode: AdminMode }) {
  const adminMode = mode === "admin";

  return (
    <section className={styles.switcher} aria-label="Modo de visualização" data-surface={mode}>
      <div className={styles.status}>
        <span className={styles.statusDot} aria-hidden />
        <span>
          <strong>{adminMode ? "Modo Administrador" : "Pré-visualização de Usuário"}</strong>
          <small>A alternância muda somente apresentação e navegação.</small>
        </span>
      </div>
      <nav className={styles.options} aria-label="Alternar modo">
        {adminMode ? (
          <span aria-current="page">Administrador</span>
        ) : (
          <Link href="/admin" prefetch={false}>Administrador</Link>
        )}
        {adminMode ? (
          <Link href="/membros" prefetch={false}>Pré-visualizar Usuário</Link>
        ) : (
          <span aria-current="page">Usuário</span>
        )}
      </nav>
    </section>
  );
}
