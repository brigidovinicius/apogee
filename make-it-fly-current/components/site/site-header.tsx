import Image from "next/image";
import Link from "next/link";
import styles from "./site-shell.module.css";

type SiteSection = "home" | "opportunities" | "members";

type SiteHeaderProps = {
  current?: SiteSection;
  memberHref?: string;
  memberLabel?: string;
};

const navigation: ReadonlyArray<{ href: string; label: string; section?: SiteSection }> = [
  { href: "/", label: "Início", section: "home" },
  { href: "/oportunidades", label: "Oportunidades", section: "opportunities" },
  { href: "/galeria", label: "Galeria" },
  { href: "/loja", label: "Loja" },
  { href: "/makeitfly", label: "Make It Fly" },
];

export function SiteHeader({
  current,
  memberHref = "/membros",
  memberLabel = "Membros",
}: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link className={styles.brand} href="/" aria-label="Apogee — início">
          <Image
            src="/brand/apogee-logo-white.svg"
            alt=""
            width={1595}
            height={986}
            sizes="112px"
            preload
          />
        </Link>

        <nav className={styles.desktopNavigation} aria-label="Navegação principal">
          {navigation.map((item) => (
            <Link
              href={item.href}
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
          aria-current={current === "members" ? "page" : undefined}
        >
          {memberLabel}
        </Link>

        <details className={styles.mobileNavigation}>
          <summary aria-label="Abrir navegação">Menu</summary>
          <nav aria-label="Navegação móvel">
            {navigation.map((item) => (
              <Link
                href={item.href}
                key={item.href}
                aria-current={item.section === current ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
            <Link href={memberHref} aria-current={current === "members" ? "page" : undefined}>
              {memberLabel}
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
