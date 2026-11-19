"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { usesApogeeDesign } from "./design-scope.mjs";
import styles from "./apogee-design-system.module.css";

// Keep the styles and their theme on the routes that render the Apogee interface.
export function ApogeeInterface({ children, editorial = false }: { children: ReactNode; editorial?: boolean }) {
  return <div className={editorial ? styles.interface : styles.scope} data-ap-interface="" data-ap-theme="sistema" data-apogee-design={editorial ? undefined : true}>
    <link id="ap-foundations" rel="stylesheet" href="/design-system/apogee.css" precedence="apogee" />
    <link id="ap-interface" rel="stylesheet" href="/design-system/interface.css" precedence="apogee" />
    {children}
  </div>;
}

export function ApogeeDesignSystem({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!usesApogeeDesign(pathname)) return children;
  return <ApogeeInterface>{children}</ApogeeInterface>;
}
