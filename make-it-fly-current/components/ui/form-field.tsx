import type { ReactNode } from "react";
import styles from "./form-field.module.css";

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: (props: {
    id: string;
    className: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => ReactNode;
};

export function FormField({ name, label, error, hint, children }: FieldProps) {
  const id = `field-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>{label}</label>
      {children({
        id,
        className: styles.control,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {hint ? <span className={styles.hint} id={`${id}-hint`}>{hint}</span> : null}
      {error ? <span className={styles.error} id={`${id}-error`}>{error}</span> : null}
    </div>
  );
}

export function FormMessage({ message }: { message?: string }) {
  return message ? <p className={styles.message} role="alert">{message}</p> : null;
}
