import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/members/members.module.css";

export const metadata: Metadata = {
  title: { default: "Área de membros | Apogee", template: "%s | Membros Apogee" },
  robots: { index: false, follow: false },
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader current="members" />
      <main className={styles.page} id="experiencia">{children}</main>
      <SiteFooter />
    </>
  );
}
