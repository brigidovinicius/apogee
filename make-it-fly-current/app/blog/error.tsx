"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatePanel, statePanelStyles } from "@/components/ui/state-panel";
import styles from "./blog.module.css";

export default function BlogError({ reset }: { reset: () => void }) {
  return <div className={styles.page}>
    <SiteHeader current="blog" />
    <main id="experiencia" tabIndex={-1} className={styles.main} style={{ paddingBlock: "4rem" }}>
      <div role="alert">
        <StatePanel eyebrow="Blog Apogee" title="A leitura espera um instante." description="Não foi possível carregar as publicações. Tente novamente em alguns instantes."
          actions={<><button className={statePanelStyles.primary} type="button" onClick={reset}>Tentar novamente</button><Link className={statePanelStyles.secondary} href="/">Voltar ao início</Link></>} />
      </div>
    </main>
    <SiteFooter />
  </div>;
}
