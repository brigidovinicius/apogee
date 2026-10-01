import Link from "next/link";
import styles from "./members.module.css";

export function Pagination({ basePath, page, pages }: { basePath: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const href = (target: number) => (target === 1 ? basePath : `${basePath}?pagina=${target}`);
  return (
    <nav className={styles.pagination} aria-label="Paginação">
      {page > 1 ? <Link href={href(page - 1)}>← Anterior</Link> : <span />}
      <span>
        Página {page} de {pages}
      </span>
      {page < pages ? <Link href={href(page + 1)}>Próxima →</Link> : <span />}
    </nav>
  );
}
