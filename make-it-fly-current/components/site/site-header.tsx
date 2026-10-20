import Image from "next/image";
import Link from "next/link";
import { SiteMobileNavigation } from "./site-mobile-navigation";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members" | "blog" | "gallery" | "store";

type SiteHeaderProps = {
  current?: SiteSection;
  memberHref?: string;
  memberLabel?: string;
  tone?: "dark" | "light";
  prefetch?: boolean;
  eventLink?: boolean;
};

const navigation: ReadonlyArray<{ href: string; label: string; section?: SiteSection }> = [
  { href: "/", label: "Início", section: "home" },
  { href: "/oportunidades", label: "Oportunidades", section: "opportunities" },
  { href: "/blog", label: "Blog", section: "blog" },
  { href: "/galeria", label: "Galeria", section: "gallery" },
  { href: "/loja", label: "Loja", section: "store" },
  { href: "/makeitfly", label: "Make It Fly" },
];

export function SiteHeader({
  current,
  memberHref = "/membros",
  memberLabel = "Membros",
  tone = "dark",
  prefetch,
  eventLink = false,
}: SiteHeaderProps) {
  const links = eventLink ? [...navigation, { href: "/makeitfly#participar", label: "Participar" }] : navigation;
  return (
    <header className={styles.header} data-tone={tone}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="Apogee - início" prefetch={prefetch}>
          <Image
            src={tone === "light" ? "/brand/apogee-logo-navy.svg" : "/brand/apogee-logo-white.svg"}
            alt=""
            width={1595}
            height={986}
            sizes="112px"
            preload
          />
        </Link>

        <nav className={styles.desktopNavigation} aria-label="Navegação principal">
          {links.map((item) => (
            <Link
              href={item.href}
              prefetch={prefetch}
              key={item.href}
              aria-current={item.section === current ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          className={styles.memberLink}
          href={memberHref}
          prefetch={prefetch}
          aria-current={current === "members" ? "page" : undefined}
        >
          {memberLabel}
        </Link>

        <SiteMobileNavigation>
            {links.map((item) => (
              <Link
                href={item.href}
                prefetch={prefetch}
                key={item.href}
                aria-current={item.section === current ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <Link href={memberHref} prefetch={prefetch} aria-current={current === "members" ? "page" : undefined}>
              {memberLabel}
            </Link>
        </SiteMobileNavigation>
      </div>
    </header>
  );
}
