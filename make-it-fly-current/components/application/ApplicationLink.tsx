"use client";

import type { ReactNode } from "react";
import { flushJourneyEvents, trackJourney } from "@/components/analytics/journey-client";
import ButtonWithIcon from "@/components/ui/button-witn-icon";
import { rememberAttribution } from "./application-client";

export function ApplicationLink({ children, className }: { children: ReactNode; className?: string }) {
  return <ButtonWithIcon href="/participar" className={className} onClick={(event) => {
    rememberAttribution();
    const section = event.currentTarget.closest<HTMLElement>("[data-flight-section][id]");
    trackJourney("cta_click", section?.id || "topbar");
    void flushJourneyEvents();
  }} prefetch={false}>{children}</ButtonWithIcon>;
}
