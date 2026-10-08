import type { ReactNode } from "react";
import styles from "./admin.module.css";

export function AdminPageHeader({
  eyebrow = "Administração Apogee",
  title,
  description,
  aside,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <div className={styles.pageHeaderAside}>{aside}</div> : null}
    </header>
  );
}

export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className={styles.metricCard}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

export function AdminNotice({
  tone = "neutral",
  title,
  description,
  action,
}: {
  tone?: "neutral" | "attention" | "success";
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <article className={styles.notice} data-tone={tone}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action ? <div>{action}</div> : null}
    </article>
  );
}

export { styles as adminStyles };
