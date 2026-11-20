"use client";

import Image from "next/image";
import Link from "next/link";
import { COMMUNITY_PLANS_PATH } from "@/content/community-offer";
import { useSiteLegalLinks } from "./site-legal-links";
import { McpConnectLink } from "./mcp-connect-link";
import styles from "./site-footer.module.css";

export function SiteFooter({ editorial = false, description = "Comunidade e experiências para tirar ideias do papel" }: {
  editorial?: boolean;
  description?: string;
}) {
  const legal = useSiteLegalLinks();
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link href="/" prefetch={false} aria-label="Apogee - página inicial">
              <Image src="/brand/apogee-logo-white.svg" alt="" width={1595} height={986} sizes="112px" />
            </Link>
            <p>{description}</p>
          </div>
          <nav className={styles.groups} aria-label="Navegação do rodapé">
            <div className={styles.group}>
              <h2>Plataforma</h2>
              <ul>
                <li><Link href="/comunidade" prefetch={false}>Comunidade</Link></li>
                <li><Link href="/oportunidades" prefetch={false}>Radar</Link></li>
                <li><Link href="/beneficios" prefetch={false}>Benefícios</Link></li>
              </ul>
            </div>
            <div className={styles.group}>
              <h2>Explore a Apogee</h2>
              <ul>
                <li><Link href="/blog" prefetch={false}>Blog</Link></li>
                <li><Link href="/galeria" prefetch={false}>Galeria</Link></li>
                <li><Link href="/loja" prefetch={false}>Loja</Link></li>
                <li><Link href="/evento-openai" prefetch={false}>Evento gratuito</Link></li>
              </ul>
            </div>
            <div className={styles.group}>
              <h2>Acesso</h2>
              <ul>
                <li><Link href="/membros" prefetch={false}>Área de membros</Link></li>
                <li><Link href={COMMUNITY_PLANS_PATH} prefetch={false}>Planos da comunidade</Link></li>
                <McpConnectLink label="Integrações de IA" listItem />
              </ul>
            </div>
          </nav>
        </div>
        {(editorial || legal.privacy || legal.terms) && <div className={styles.bottom}>
          {editorial && <p><span translate="no">Building the future.</span> Apogee Builders Club · Florianópolis</p>}
          {(legal.privacy || legal.terms) && <nav className={styles.legal} aria-label="Informações legais">
            {legal.privacy && <Link href="/privacidade" prefetch={false}>Privacidade</Link>}
            {legal.terms && <Link href="/termos" prefetch={false}>Termos de uso</Link>}
          </nav>}
        </div>}
      </div>
    </footer>
  );
}
