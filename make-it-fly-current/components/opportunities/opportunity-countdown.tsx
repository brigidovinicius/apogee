"use client";

import { useSyncExternalStore } from "react";
import { Clock3 } from "lucide-react";
import type { StudentOpportunity } from "@/lib/opportunities/types";
import { opportunityCountdown } from "@/lib/opportunities/countdown";
import styles from "./opportunities.module.css";

// One shared clock for the visible cards; always recompute from the actual time.
let now: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function tick() { now = Date.now(); listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
      now = null;
      document.removeEventListener("visibilitychange", tick);
    }
  };
}
const snapshot = () => now;
const serverSnapshot = () => null;

export function OpportunityCountdown({ opportunity }: { opportunity: StudentOpportunity }) {
  const now = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const countdown = opportunityCountdown(opportunity, now);
  return <div className={styles.countdown} data-tone={countdown.tone ?? undefined}>
    <Clock3 size={17} aria-hidden />
    <div>
      <span>{countdown.label}</span>
      <strong role="timer" aria-live="off" aria-label={`${countdown.label}: ${countdown.value}`}>
        {countdown.value}
      </strong>
      {countdown.target ? <time dateTime={countdown.target}>
        {new Intl.DateTimeFormat("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric", timeZone: countdown.target.length === 10 ? "UTC" : "America/Sao_Paulo",
          ...(countdown.target.length > 10 ? { hour: "2-digit", minute: "2-digit" } : {}),
        }).format(new Date(countdown.target))}{countdown.target.length > 10 ? " (Brasília)" : ""}
      </time> : null}
    </div>
  </div>;
}
