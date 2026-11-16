import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import styles from "@/components/members/members.module.css";

export const metadata: Metadata = {
  title: { default: "Área de membros | Apogee", template: "%s | Membros Apogee" },
  robots: { index: false, follow: false },
};

export default function MembersLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader current="members" compact />
      <main className={styles.page} id="experiencia">{children}</main>
      <footer className={styles.memberFooter}>
        <Link href="/">Apogee</Link>
        <nav aria-label="Ajuda e termos"><Link href="/membros/suporte">Suporte</Link><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos de uso</Link></nav>
      </footer>
    </>
  );
}
