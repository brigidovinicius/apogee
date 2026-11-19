import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteMobileNavigation } from "./site-mobile-navigation";
import { McpConnectLink } from "./mcp-connect-link";
import { AccountMenu } from "@/components/members/account-menu";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members" | "blog" | "gallery" | "store" | "community";

type SiteHeaderProps = {
  compact?: boolean;
  current?: SiteSection;
  memberHref?: string;
  memberLabel?: string;
  tone?: "dark" | "light";
  prefetch?: boolean;
  adaptive?: boolean;
};

const navigation: ReadonlyArray<{ href: string; label: string; section?: SiteSection }> = [
  { href: "/comunidade", label: "Comunidade", section: "community" },
  { href: "/oportunidades", label: "Radar", section: "opportunities" },
  { href: "/blog", label: "Blog", section: "blog" },
];
const moreLinks: typeof navigation = [
  { href: "/loja", label: "Loja", section: "store" },
  { href: "/galeria", label: "Galeria", section: "gallery" },
  { href: "/evento-openai", label: "Evento gratuito" },
];

export function SiteHeader({
  compact = false,
  current,
  memberHref = "/membros",
  memberLabel = "Entrar",
  tone = "dark",
  prefetch,
  adaptive = false,
}: SiteHeaderProps) {
  const renderLink = (item: (typeof navigation)[number]) => (
    <Link key={item.href} href={item.href} prefetch={prefetch}
      aria-current={item.section === current && item.section ? "page" : undefined}>
      {item.label}
    </Link>
  );
  const more = <>{moreLinks.map(renderLink)}<McpConnectLink /><McpConnectLink provider="claude" /></>;
  const desktopNavigation = (
    <nav className={styles.desktopNavigation} aria-label="Navegação principal">
      {navigation.map(renderLink)}
      <SiteMobileNavigation more>{more}</SiteMobileNavigation>
    </nav>
  );
  return (
    <header className={styles.header} data-tone={adaptive ? tone : "light"} data-adaptive={adaptive || undefined} data-editorial={!adaptive || undefined} data-compact={compact || undefined}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-current={current === "home" ? "page" : undefined} aria-label="Apogee - início" prefetch={prefetch}>
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

        {!compact && (adaptive ? desktopNavigation : <p className={styles.signature}>Ideias que abrem caminhos.</p>)}

        <div className={styles.headerActions}>
        <AccountMenu fallback={<Link
          className={styles.memberLink}
          href={memberHref}
          prefetch={prefetch}
          aria-current={current === "members" ? "page" : undefined}
        >
          {memberLabel}
          {!adaptive && <ArrowUpRight aria-hidden="true" size={18} />}
        </Link>} />

        {!compact && <SiteMobileNavigation>
            {navigation.map(renderLink)}
            {more}
        </SiteMobileNavigation>}
        </div>
      </div>
      {!compact && !adaptive && <div className={styles.navigationBar}>{desktopNavigation}</div>}
    </header>
  );
}
