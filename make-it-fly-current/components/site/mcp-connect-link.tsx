"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";

const McpEnabledContext = createContext(false);

export function McpAvailabilityProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <McpEnabledContext.Provider value={enabled}>{children}</McpEnabledContext.Provider>;
}

export function McpConnectLink({ className }: { className?: string }) {
  return useContext(McpEnabledContext)
    ? <Link className={className} href="/membros/integracoes/mcp" prefetch={false}>Incluir no meu ChatGPT</Link>
    : null;
}
