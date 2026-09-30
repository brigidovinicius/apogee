"use client";

import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Frame, Menu, NotebookPen, Orbit, Shirt } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./commerce-hero.module.css";

export interface CommerceHeroCategory {
  id?: string;
  title: string;
  description?: string;
  href: string;
  visual: ReactNode;
}

export interface CommerceHeroNavigation {
  name: string;
  href: string;
}

export interface CommerceHeroProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  brand?: ReactNode;
  brandLabel?: string;
  brandHref?: string;
  navigation?: readonly CommerceHeroNavigation[];
  categories?: readonly CommerceHeroCategory[];
  headingId?: string;
  background?: ReactNode;
  headerActions?: ReactNode;
  /** Omit to follow the operating system; the store can supply its own override. */
  motionEnabled?: boolean;
  /** The host owns its existing accessible menu/dialog and focus restoration. */
  onMenuRequest?: () => void;
  menuOpen?: boolean;
  menuControls?: string;
}

const defaultNavigation: readonly CommerceHeroNavigation[] = [
  { name: "Início", href: "/" },
  { name: "Coleção", href: "#produtos" },
  { name: "Nossa história", href: "/galeria" },
];

const defaultCategories: readonly CommerceHeroCategory[] = [
  { title: "Vestuário", href: "#produtos", visual: <Shirt strokeWidth={0.8} /> },
  { title: "Papelaria", href: "#produtos", visual: <NotebookPen strokeWidth={0.8} /> },
  { title: "Objetos", href: "#produtos", visual: <Orbit strokeWidth={0.8} /> },
  { title: "Edições", href: "#produtos", visual: <Frame strokeWidth={0.8} /> },
];

/** A collection-led storefront hero; every action has a real destination. */
export function CommerceHero({
  id = "colecao",
  className,
  title = <><span>Itens para quem vai</span><br /><span>mudar o mundo</span></>,
  description = "Peças e edições em desenvolvimento para acompanhar ideias, encontros e novas trajetórias.",
  brand = <>Apogee<span className={styles.brandMark} aria-hidden="true">✦</span></>,
  brandLabel = "Apogee — início",
  brandHref = "/",
  navigation = defaultNavigation,
  categories = defaultCategories,
  headingId = "store-title",
  background,
  headerActions,
  motionEnabled,
  onMenuRequest,
  menuOpen = false,
  menuControls = "store-mobile-menu",
  children,
  ...props
}: CommerceHeroProps) {
  const systemReduced = useReducedMotion();
  // Render readable content until the browser preference is known. Pausing
  // settles all transforms immediately instead of leaving a half-hidden title.
  const animate = motionEnabled ?? systemReduced === false;
  const entrance = animate ? { opacity: 0, y: 20 } : false;
  const settle = { opacity: 1, y: 0 };

  return (
    <section
      {...props}
      id={id}
      aria-labelledby={headingId}
      className={cn(styles.root, className)}
      data-commerce-hero
      data-commerce-motion={animate ? "full" : "reduced"}
      data-commerce-menu={onMenuRequest ? "controlled" : "inline"}
    >
      <div className={styles.panel} data-commerce-panel>
        {background && <div className={styles.background} data-commerce-background aria-hidden="true">{background}</div>}

        <header className={styles.header}>
          <div className={styles.notch}>
            <Link className={styles.brand} href={brandHref} aria-label={brandLabel}>{brand}</Link>
            <nav className={styles.navigation} aria-label="Navegação da loja">
              {navigation.map((item) => (
                <Button key={`${item.name}-${item.href}`} variant="link" asChild className={styles.navigationLink}>
                  <Link href={item.href}>{item.name}</Link>
                </Button>
              ))}
            </nav>
            {onMenuRequest && (
              <Button
                className={styles.menuButton}
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
                aria-controls={menuControls}
                onClick={onMenuRequest}
              >
                <Menu aria-hidden="true" size={21} strokeWidth={1.5} />
              </Button>
            )}
          </div>
          {headerActions && <div className={styles.headerActions}>{headerActions}</div>}
        </header>

        <div className={styles.intro} data-store-hero>
          <motion.h1
            id={headingId}
            className={styles.title}
            initial={entrance}
            animate={settle}
            transition={{ duration: animate ? 0.65 : 0, delay: animate ? 0.12 : 0, ease: "easeOut" }}
          >
            {title}
          </motion.h1>
          <motion.p
            className={styles.description}
            initial={entrance}
            animate={settle}
            transition={{ duration: animate ? 0.65 : 0, delay: animate ? 0.24 : 0, ease: "easeOut" }}
          >
            {description}
          </motion.p>
          {children && <div className={styles.introActions}>{children}</div>}
        </div>
      </div>

      {categories.length > 0 && (
        <nav className={styles.categories} aria-label="Categorias da coleção">
          {categories.map((category, index) => (
            <motion.article
              id={category.id}
              key={`${category.title}-${category.href}`}
              className={styles.category}
              data-commerce-category
              initial={entrance}
              animate={settle}
              whileHover={animate
                ? { y: -5, transition: { duration: 0.25, delay: 0, ease: "easeOut" } }
                : { y: 0, transition: { duration: 0 } }}
              transition={{ duration: animate ? 0.45 : 0, delay: animate ? index * 0.06 : 0, ease: "easeOut" }}
            >
              <Link href={category.href} className={styles.categoryLink}>
                <div className={styles.categoryHeading}>
                  <h2>{category.title}</h2>
                  {category.description && <p>{category.description}</p>}
                </div>
                <div className={styles.categoryArtwork} aria-hidden="true">{category.visual}</div>
                <span className={styles.cutout} aria-hidden="true">
                  <span className={styles.arrow}><ArrowUpRight size={21} strokeWidth={1.6} /></span>
                </span>
              </Link>
            </motion.article>
          ))}
        </nav>
      )}
    </section>
  );
}
