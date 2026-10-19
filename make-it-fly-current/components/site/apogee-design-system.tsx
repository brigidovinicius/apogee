"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usesApogeeDesign } from "./design-scope.mjs";
import styles from "./apogee-design-system.module.css";

// Server-rendered children retain their existing data and authorization boundaries.
export function ApogeeDesignSystem({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!usesApogeeDesign(pathname)) return children;
  return <div className={styles.scope} data-apogee-design>{children}</div>;
}
