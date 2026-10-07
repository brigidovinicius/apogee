import type { ReactNode } from "react";
import styles from "./state-panel.module.css";

type StatePanelProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  busy?: boolean;
  role?: "alert" | "status";
};

export function StatePanel({
  eyebrow,
  title,
  description,
  actions,
  busy = false,
  role = "status",
}: StatePanelProps) {
  return (
    <section className={styles.panel} aria-busy={busy || undefined} aria-live="polite" role={role}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.description}>{description}</p>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}

export const statePanelStyles = styles;
