import Image from "next/image";
import Link from "next/link";
import { SiteMobileNavigation } from "./site-mobile-navigation";
import { AccountMenu, CommunityEntryLink } from "@/components/members/account-menu";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members" | "blog" | "gallery" | "store" | "community" | "benefits";

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
  { href: "/beneficios", label: "Benefícios", section: "benefits" },
];

export function SiteHeader({
  compact = false,
  current,
  memberLabel = "Entrar",
  memberHref,
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
  const desktopNavigation = (
    <nav className={styles.desktopNavigation} aria-label="Navegação principal">
      {navigation.map(renderLink)}
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
        {compact ? <AccountMenu fallback={<CommunityEntryLink className={styles.memberLink} />} /> :
          <CommunityEntryLink className={styles.memberLink} offerHref={memberHref} label={memberLabel} />}

        {!compact && <SiteMobileNavigation>
            {navigation.map(renderLink)}
        </SiteMobileNavigation>}
        </div>
      </div>
      {!compact && !adaptive && <div className={styles.navigationBar}>{desktopNavigation}</div>}
    </header>
  );
}
