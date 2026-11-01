"use client";

import { createContext, useContext, type ReactNode } from "react";

type SiteLegalLinks = { privacy: boolean; terms: boolean };
const LegalLinksContext = createContext<SiteLegalLinks>({ privacy: false, terms: false });

// Keep the server's availability decision throughout hydration and navigation.
export function SiteLegalLinksProvider({ value, children }: { value: SiteLegalLinks; children: ReactNode }) {
  return <LegalLinksContext.Provider value={value}>{children}</LegalLinksContext.Provider>;
}

export function useSiteLegalLinks() {
  return useContext(LegalLinksContext);
}
