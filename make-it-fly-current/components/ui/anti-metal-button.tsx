"use client";

import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import styles from "./anti-metal-button.module.css";

type DoubleChevronProps = { index: number; dotColor: string };

const dots = [
  { cx: 2, cy: 2, d: 0 },
  { cx: 5, cy: 5, d: 0.05 },
  { cx: 8, cy: 8, d: 0.1 },
  { cx: 5, cy: 11, d: 0.15 },
  { cx: 2, cy: 14, d: 0.2 },
  { cx: 6, cy: 2, d: 0.05 },
  { cx: 9, cy: 5, d: 0.1 },
  { cx: 12, cy: 8, d: 0.15 },
  { cx: 9, cy: 11, d: 0.2 },
  { cx: 6, cy: 14, d: 0.25 },
];

function DoubleChevron({ index, dotColor }: DoubleChevronProps) {
  return (
    <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" focusable="false" className="shrink-0 overflow-visible">
      <g fill={dotColor}>
        {dots.map((point, i) => (
          <circle key={i} cx={point.cx} cy={point.cy} r="1" className={styles.dot} style={{ animationDelay: `${index * 0.12 + point.d}s` }} />
        ))}
      </g>
    </svg>
  );
}

export interface AntiMetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Compose with a single link child, preserving its href and navigation behavior. */
  asChild?: boolean;
  /** Button text; with asChild, put the text inside the link instead. */
  label?: React.ReactNode;
  accentFrom?: string;
  accentTo?: string;
  dotColor?: string;
}

export const AntiMetalButton = React.forwardRef<HTMLButtonElement, AntiMetalButtonProps>(
  ({ className, children, label, asChild = false, type = "button", accentFrom = "#d6f54a", accentTo = "#c5ea2c", dotColor = "#0f0f0f", ...props }, ref) => {
    const content = label ?? children ?? "Book a demo";
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : type}
        className={cn(
          styles.button,
          "relative inline-flex min-h-11 min-w-36 max-w-full items-center overflow-hidden rounded-xl border-0 py-3 pr-4 pl-14 text-left text-sm leading-5 font-medium tracking-tight text-white no-underline transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none dark:text-[#0a0a0a]",
          "bg-[linear-gradient(180deg,#1a1a1a_0%,#0a0a0a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_12px_rgba(0,0,0,0.18)]",
          "dark:bg-[linear-gradient(180deg,#ffffff_0%,#ededed_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.35)]",
          className,
        )}
        {...props}
      >
        {asChild ? <Slottable>{children}</Slottable> : content}
        <span
          aria-hidden="true"
          className={cn(styles.accent, "absolute inset-y-1 left-1 z-10 flex w-9 items-center justify-start gap-2.5 overflow-hidden rounded-md pr-2.5 pl-3")}
          style={{
            background: `linear-gradient(180deg, ${accentFrom} 0%, ${accentTo} 100%)`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)",
          }}
        >
          {Array.from({ length: 5 }, (_, index) => <DoubleChevron key={index} index={index} dotColor={dotColor} />)}
        </span>
      </Comp>
    );
  },
);

AntiMetalButton.displayName = "AntiMetalButton";

export default AntiMetalButton;
