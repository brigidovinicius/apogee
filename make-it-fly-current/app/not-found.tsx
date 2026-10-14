import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatePanel, statePanelStyles } from "@/components/ui/state-panel";

export default function NotFound() {
  return <>
    <SiteHeader />
    <main id="experiencia" tabIndex={-1}>
      <StatePanel
        eyebrow="Apogee · 404"
        title="Página não encontrada."
        description="Este endereço não está disponível. Explore a comunidade ou volte ao início."
        actions={<>
          <Link className={statePanelStyles.primary} href="/">Voltar ao início</Link>
          <Link className={statePanelStyles.secondary} href="/galeria">Conhecer a galeria</Link>
        </>}
      />
    </main>
    <SiteFooter />
  </>;
}
