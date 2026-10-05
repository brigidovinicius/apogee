import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { InternalFooter } from "@/components/site/internal-footer";
import { InternalHeader } from "@/components/site/internal-header";
import styles from "@/components/members/members.module.css";
import { hexclaveServerApp } from "@/lib/hexclave/server";

export const metadata: Metadata = {
  title: { default: "Área de membros | Apogee", template: "%s | Membros Apogee" },
  robots: { index: false, follow: false },
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return (
    <HexclaveProvider app={hexclaveServerApp}>
      <HexclaveTheme>
        <InternalHeader current="membros" />
        <main className={styles.page} id="experiencia">{children}</main>
        <InternalFooter />
      </HexclaveTheme>
    </HexclaveProvider>
  );
}
