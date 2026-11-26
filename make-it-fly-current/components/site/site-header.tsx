import { areaForPath } from "./design-scope.mjs";
import { AreaIcon } from "./area-icon";
import Image from "next/image";
import Link from "next/link";
import { SiteMobileNavigation } from "./site-mobile-navigation";
import { AccountMenu, CommunityEntryLink, MemberBrandLink } from "@/components/members/account-menu";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members" | "blog" | "gallery" | "store" | "community" | "benefits";
type SiteNavItem = { href: string; label: string; section?: SiteSection; area?: string };

type SiteHeaderProps = {
  compact?: boolean;
  current?: SiteSection;
  memberHref?: string;
  memberLabel?: string;
  tone?: "dark" | "light";
  prefetch?: boolean;
  adaptive?: boolean;
};

const navigation: readonly SiteNavItem[] = [
  { href: "/comunidade", label: "Comunidade", section: "community" },
  { href: "/oportunidades", label: "Radar", section: "opportunities" },
  { href: "/beneficios", label: "Benefícios", section: "benefits" },
];

const explore: readonly SiteNavItem[] = [
  { href: "/blog", label: "Blog", section: "blog" },
  { href: "/comunidade#participar", label: "Eventos", area: "eventos" },
  { href: "/galeria", label: "Galeria Make It Fly", section: "gallery" },
  { href: "/loja", label: "Loja", section: "store" },
];

const plans: SiteNavItem = { href: "/comunidade#planos", label: "Ver planos", area: "assinatura" };

export function SiteHeader({
  compact = false,
  current,
  memberLabel = "Entrar",
  memberHref,
  tone = "dark",
  prefetch,
  adaptive = false,
}: SiteHeaderProps) {
  const renderLink = (item: SiteNavItem) => (
    <Link key={item.href} href={item.href} prefetch={prefetch}
      aria-current={item.section === current && item.section ? "page" : undefined}>
      <AreaIcon area={item.area ?? areaForPath(item.href)} />{item.label}
    </Link>
  );
  const desktopNavigation = (
    <nav className={styles.desktopNavigation} aria-label="Navegação principal">
      {navigation.map(renderLink)}
      <SiteMobileNavigation more>{explore.map(renderLink)}</SiteMobileNavigation>
      {renderLink(plans)}
    </nav>
  );
  const brandArtwork = <>
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
  </>;
  return (
    <header className={styles.header} data-tone={adaptive ? tone : "light"} data-adaptive={adaptive || undefined} data-editorial={!adaptive || undefined} data-compact={compact || undefined}>
      <div className={styles.headerInner}>
        {compact
          ? <MemberBrandLink className={styles.brand}>{brandArtwork}</MemberBrandLink>
          : <Link className={styles.brand} href="/" aria-current={current === "home" ? "page" : undefined} aria-label="Apogee - início" prefetch={prefetch}>{brandArtwork}</Link>}

        {!compact && (adaptive ? desktopNavigation : <p className={styles.signature}>Ideias que abrem caminhos.</p>)}

        <div className={styles.headerActions}>
          {compact ? <AccountMenu fallback={<CommunityEntryLink className={styles.memberLink} />} /> :
            <CommunityEntryLink className={styles.memberLink} href={memberHref} label={memberLabel} />}
          {!compact && <SiteMobileNavigation>
            {navigation.map(renderLink)}
            {renderLink(plans)}
            <div className={styles.mobileExplore}>
              <p>Explorar</p>
              {explore.map(renderLink)}
            </div>
          </SiteMobileNavigation>}
        </div>
      </div>
      {!compact && !adaptive && <div className={styles.navigationBar}>{desktopNavigation}</div>}
    </header>
  );
}
