"use client";

import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import styles from "./editorial-page-shell.module.css";

export function EditorialPageShell({ current, children, className, memberHref }: {
  current: "community" | "store" | "benefits"; children: ReactNode; className?: string; memberHref?: string;
}) {
  return <div className={[styles.page, className].filter(Boolean).join(" ")} data-editorial-page={current}>
    <SiteHeader current={current} tone="light" adaptive prefetch={false} memberHref={memberHref} />
    {children}
    <SiteFooter editorial description="Comunidade, ideias e experiências." />
  </div>;
}
