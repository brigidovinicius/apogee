"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { areaForPath, usesApogeeDesign } from "./design-scope.mjs";
import styles from "./apogee-design-system.module.css";

// Keep the styles and their theme on the routes that render the Apogee interface.
export function ApogeeInterface({ children, editorial = false, area }: { children: ReactNode; editorial?: boolean; area?: string }) {
  return <div className={editorial ? styles.interface : styles.scope} data-ap-interface="" data-ap-art={area} data-ap-theme="sistema" data-apogee-design={editorial ? undefined : true}>
    <link id="ap-foundations" rel="stylesheet" href="/design-system/apogee.css" precedence="apogee" />
    <link id="ap-interface" rel="stylesheet" href="/design-system/interface.css" precedence="apogee" />
    {children}
  </div>;
}

export function ApogeeDesignSystem({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!usesApogeeDesign(pathname)) return children;
  return <ApogeeInterface area={areaForPath(pathname)}>{children}</ApogeeInterface>;
}
