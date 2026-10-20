// Adapted from Hyperiux Vault: https://vault.hyperiux.com
"use client";

import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import styles from "./arrow-fill-button.module.css";

export interface ArrowFillButtonOwnProps {
  btnText?: string;
  href?: string;
  className?: string;
  bgColor?: string;
  textColor?: string;
  fillBgColor?: string;
  fillTextColor?: string;
  hoverFillBgColor?: string;
  hoverFillTextColor?: string;
  arrowColor?: string;
  hoverArrowColor?: string;
  animationDuration?: number;
  fillOnHover?: boolean;
  prefetch?: boolean;
}

export type ArrowFillButtonProps = ArrowFillButtonOwnProps & Omit<ComponentPropsWithoutRef<"a">, keyof ArrowFillButtonOwnProps | "children">;

export default function ArrowFillButton({
  btnText = "Hover Me", href = "#", className,
  bgColor = "#25D366", textColor = "#07182d",
  fillBgColor = "#ffffff", fillTextColor = "#075e54",
  hoverFillBgColor = "#ffffff", hoverFillTextColor = "#075e54",
  arrowColor, hoverArrowColor, animationDuration = 450, fillOnHover = true,
  prefetch = false, style, onPointerDown, onPointerUp, onPointerCancel, ...props
}: ArrowFillButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const releaseTimeoutRef = useRef<number | null>(null);
  const duration = Number.isFinite(animationDuration) ? Math.max(0, animationDuration) : 450;

  useEffect(() => () => {
    if (releaseTimeoutRef.current !== null) window.clearTimeout(releaseTimeoutRef.current);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLAnchorElement>) {
    onPointerDown?.(event);
    if (event.defaultPrevented || event.pointerType === "mouse") return;
    if (releaseTimeoutRef.current !== null) window.clearTimeout(releaseTimeoutRef.current);
    setIsPressed(true);
  }

  function releasePressedState(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse") return;
    if (releaseTimeoutRef.current !== null) window.clearTimeout(releaseTimeoutRef.current);
    releaseTimeoutRef.current = window.setTimeout(() => {
      setIsPressed(false);
      releaseTimeoutRef.current = null;
    }, duration);
  }

  const colors = {
    "--btn-bg": bgColor, "--btn-text": textColor,
    "--btn-fill-bg": fillBgColor, "--btn-fill-text": fillTextColor,
    "--btn-fill-bg-hover": hoverFillBgColor, "--btn-fill-text-hover": hoverFillTextColor,
    "--btn-arrow": arrowColor ?? fillTextColor,
    "--btn-arrow-hover": hoverArrowColor ?? hoverFillTextColor,
    "--btn-duration": `${duration}ms`,
    ...style,
  } as CSSProperties;

  return (
    <Link
      {...props}
      href={href}
      prefetch={prefetch}
      className={cn(styles.button, className)}
      style={colors}
      data-pressed={isPressed ? "true" : "false"}
      data-fill-on-hover={fillOnHover ? "true" : "false"}
      onPointerDown={handlePointerDown}
      onPointerUp={(event) => { onPointerUp?.(event); releasePressedState(event); }}
      onPointerCancel={(event) => { onPointerCancel?.(event); releasePressedState(event); }}
    >
      <span className={styles.label}>{btnText}</span>
      <span aria-hidden="true" className={styles.fill} />
      <span aria-hidden="true" className={styles.fillLabel}>{btnText}</span>
      <span aria-hidden="true" className={styles.icon}>
        <ArrowRight className={styles.enteringArrow} strokeWidth={1.8} />
        <ArrowRight className={styles.leavingArrow} strokeWidth={1.8} />
      </span>
    </Link>
  );
}
