import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteMobileNavigation } from "./site-mobile-navigation";
import { McpConnectLink } from "./mcp-connect-link";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members" | "blog" | "gallery" | "store";

type SiteHeaderProps = {
  current?: SiteSection;
  memberHref?: string;
  memberLabel?: string;
  tone?: "dark" | "light";
  prefetch?: boolean;
  eventLink?: boolean;
  adaptive?: boolean;
};

const navigation: ReadonlyArray<{ href: string; label: string; section?: SiteSection }> = [
  { href: "/", label: "Início", section: "home" },
  { href: "/oportunidades", label: "Oportunidades", section: "opportunities" },
  { href: "/blog", label: "Blog", section: "blog" },
  { href: "/galeria", label: "Galeria", section: "gallery" },
  { href: "/loja", label: "Loja", section: "store" },
  { href: "/comunidade", label: "Comunidade" },
];

export function SiteHeader({
  current,
  memberHref = "/membros",
  memberLabel = "Membros",
  tone = "dark",
  prefetch,
  eventLink = false,
  adaptive = false,
}: SiteHeaderProps) {
  const links = eventLink ? [...navigation, { href: "/evento-openai", label: "Evento gratuito" }] : navigation;
  const desktopNavigation = (
    <nav className={styles.desktopNavigation} aria-label="Navegação principal">
      {links.map((item, index) => (
        <Link
          href={item.href}
          prefetch={prefetch}
          key={item.href}
          data-compact={index < 3 || undefined}
          aria-current={item.section !== undefined && item.section === current ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      <McpConnectLink className={styles.mcpLink} />
    </nav>
  );
  return (
    <header className={styles.header} data-tone={adaptive ? tone : "light"} data-adaptive={adaptive || undefined} data-editorial={!adaptive || undefined}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="Apogee - início" prefetch={prefetch}>
          <Image
            className={adaptive ? styles.adaptiveWhite : undefined}
            src={!adaptive || tone === "light" ? "/brand/apogee-logo-navy.svg" : "/brand/apogee-logo-white.svg"}
            alt=""
            width={1595}
            height={986}
            sizes="112px"
            preload
          />
          {adaptive && <Image className={styles.adaptiveNavy} src="/brand/apogee-logo-navy.svg" alt="" width={1595} height={986} sizes="112px" />}
        </Link>

        {adaptive ? desktopNavigation : <p className={styles.signature}>Ideias que abrem caminhos.</p>}

        <Link
          className={styles.memberLink}
          href={memberHref}
          prefetch={prefetch}
          aria-current={current === "members" ? "page" : undefined}
        >
          {memberLabel}
          {!adaptive && <ArrowUpRight aria-hidden="true" size={18} />}
        </Link>

        <SiteMobileNavigation>
            {links.map((item) => (
              <Link
                href={item.href}
                prefetch={prefetch}
                key={item.href}
                aria-current={item.section !== undefined && item.section === current ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <Link href={memberHref} prefetch={prefetch} aria-current={current === "members" ? "page" : undefined}>
              {memberLabel}
            </Link>
            <McpConnectLink />
            <McpConnectLink provider="claude" />
        </SiteMobileNavigation>
      </div>
      {!adaptive && <div className={styles.navigationBar}>{desktopNavigation}</div>}
    </header>
  );
}
