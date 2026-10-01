import type { Metadata } from "next";
import type { ReactNode } from "react";
import { InternalFooter } from "@/components/site/internal-footer";
import { InternalHeader } from "@/components/site/internal-header";
import styles from "@/components/members/members.module.css";

export const metadata: Metadata = {
  title: { default: "Área de membros | Apogee", template: "%s | Membros Apogee" },
  robots: { index: false, follow: false },
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <InternalHeader current="membros" />
      <main className={styles.page} id="experiencia">{children}</main>
      <InternalFooter />
    </>
  );
}
