"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import styles from "./card-7.module.css";

export interface InteractiveProductCardProps extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl?: string;
  logoUrl?: string;
  title: string;
  description: string;
  price?: string;
  /** An original product illustration can replace a full-bleed photograph. */
  visual?: React.ReactNode;
  brand?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  showIndicators?: boolean;
  /** Omit to follow the visitor's reduced-motion preference. */
  motionEnabled?: boolean;
  /** Let the page's existing motion engine supply the CSS variables. */
  motionManaged?: boolean;
  onActivate?: () => void;
  actionLabel?: string;
  actionHasPopup?: React.AriaAttributes["aria-haspopup"];
}

/**
 * A portrait product card with a clipped backdrop and genuinely separate 3D
 * foreground planes. The outer div is reserved for layout/reveal transforms.
 */
export function InteractiveProductCard({
  className,
  imageUrl,
  logoUrl,
  title,
  description,
  price,
  visual,
  brand,
  badge,
  footer,
  showIndicators = true,
  motionEnabled,
  motionManaged = false,
  onActivate,
  actionLabel,
  actionHasPopup = "dialog",
  onMouseMove,
  onMouseLeave,
  onBlur,
  children,
  ...props
}: InteractiveProductCardProps) {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const frameRef = React.useRef(0);
  const canAnimateRef = React.useRef(false);
  const pointerRef = React.useRef({ x: 0, y: 0 });
  const descriptionId = React.useId();

  const resetPointer = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    const card = cardRef.current;
    if (!card) return;
    card.dataset.pointerActive = "false";
    card.style.setProperty("--pointer-x", "0deg");
    card.style.setProperty("--pointer-y", "0deg");
    card.style.setProperty("--hover-scale", "1");
    card.style.setProperty("--hover-lift", "0px");
    card.style.setProperty("--hover-progress", "0");
  }, []);

  React.useEffect(() => {
    // Managed cards have exactly one owner of animation and pointer state.
    if (motionManaged) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    const updatePreference = () => {
      canAnimateRef.current = (motionEnabled ?? !reduced.matches)
        && finePointer.matches && !document.hidden;
      if (!canAnimateRef.current) resetPointer();
    };
    updatePreference();
    reduced.addEventListener("change", updatePreference);
    finePointer.addEventListener("change", updatePreference);
    document.addEventListener("visibilitychange", updatePreference);
    return () => {
      reduced.removeEventListener("change", updatePreference);
      finePointer.removeEventListener("change", updatePreference);
      document.removeEventListener("visibilitychange", updatePreference);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [motionEnabled, motionManaged, resetPointer]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    onMouseMove?.(event);
    if (event.defaultPrevented || motionManaged || !canAnimateRef.current || !cardRef.current) return;
    const { left, top, width, height } = cardRef.current.getBoundingClientRect();
    if (!width || !height) return;
    pointerRef.current = {
      x: Math.max(-1, Math.min(1, ((event.clientX - left) / width - 0.5) * 2)),
      y: Math.max(-1, Math.min(1, ((event.clientY - top) / height - 0.5) * 2)),
    };
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const card = cardRef.current;
      if (!card || !canAnimateRef.current) return;
      const { x, y } = pointerRef.current;
      card.dataset.pointerActive = "true";
      card.style.setProperty("--pointer-x", `${(x * 8).toFixed(3)}deg`);
      card.style.setProperty("--pointer-y", `${(y * -8).toFixed(3)}deg`);
      card.style.setProperty("--hover-scale", "1.05");
      card.style.setProperty("--hover-progress", "1");
      card.style.setProperty("--glint-x", `${((x + 1) * 50).toFixed(2)}%`);
      card.style.setProperty("--glint-y", `${((y + 1) * 50).toFixed(2)}%`);
    });
  };

  return (
    <div
      {...props}
      ref={cardRef}
      className={cn("relative aspect-[9/12] w-full max-w-[340px] rounded-3xl", styles.card, className)}
      data-card-motion={motionEnabled === undefined ? "system" : motionEnabled ? "enabled" : "disabled"}
      data-motion-managed={motionManaged ? "true" : "false"}
      onMouseMove={handleMouseMove}
      onMouseLeave={(event) => {
        onMouseLeave?.(event);
        if (!motionManaged) resetPointer();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        if (!motionManaged && !event.currentTarget.contains(event.relatedTarget)) resetPointer();
      }}
    >
      <div className={styles.tilt} data-card-tilt>
        <div className={styles.backdrop} aria-hidden="true">
          {imageUrl && (
            // Caller-provided URLs and SVGs stay portable without a Next image-host configuration.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className={styles.image} loading="lazy" decoding="async" />
          )}
          <div className={styles.gradient} />
        </div>

        {visual && <div className={styles.artwork} data-card-artwork aria-hidden="true">{visual}</div>}
        <div className={styles.glint} aria-hidden="true" />

        <div className={styles.content}>
          <div className={styles.header} data-card-header>
            <div className={styles.copy}>
              <h3>{title}</h3>
              <p id={descriptionId}>{description}</p>
            </div>
            {(brand || logoUrl) && (
              <div className={styles.brand} aria-hidden="true">
                {brand || (
                  // Brand assets use the same portable, caller-provided URL contract.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className={styles.logo} loading="lazy" decoding="async" />
                )}
              </div>
            )}
          </div>

          {(badge != null || price) && <div className={styles.badge} data-card-badge>{badge ?? price}</div>}
          <div className={styles.bottom}>
            {footer && <div className={styles.footer} data-card-footer>{footer}</div>}
            {showIndicators && (
              <div className={styles.indicators} aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => <span key={index} data-active={index === 0} />)}
              </div>
            )}
          </div>
          {children}
        </div>

        {onActivate && (
          <button
            type="button"
            className={styles.action}
            data-card-action
            aria-label={actionLabel ?? title}
            aria-describedby={descriptionId}
            aria-haspopup={actionHasPopup}
            onClick={onActivate}
          />
        )}
      </div>
    </div>
  );
}
