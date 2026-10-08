import { adminStyles as styles } from "@/components/admin/admin-ui";

export default function AdminLoading() {
  return (
    <section className={styles.loadingState} aria-busy="true" aria-live="polite">
      <div>
        <p className={styles.eyebrow}>Administração Apogee</p>
        <p>Carregando dados autorizados…</p>
        <div className={styles.skeleton} aria-hidden />
      </div>
    </section>
  );
}
